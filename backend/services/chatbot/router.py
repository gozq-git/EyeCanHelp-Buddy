import asyncio
import os
import uuid
from contextlib import aclosing
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database.postgres import get_db
import database.mongo as mongo_module
from .schema import (
    AcknowledgementRequest,
    AcknowledgementResponse,
    ChatRequest,
    ChatResponse,
)
from .service import chat, chat_stream, save_patient_acknowledgement
from .service import save_chat_exchange

chat_router = APIRouter(prefix="/chat", tags=["Chatbot"])
acknowledgement_router = APIRouter(prefix="/acknowledgement", tags=["Acknowledgement"])

HEARTBEAT_INTERVAL_SECONDS = float(os.getenv("CHAT_STREAM_HEARTBEAT_SECONDS", "1"))

# Sentinel yielded when the upstream model produced nothing for a whole
# heartbeat interval, so the SSE connection stays warm.
_HEARTBEAT = object()


def _to_sse_frame(chunk: str) -> str:
    normalized = chunk.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")
    payload = "".join(f"data: {line}\n" for line in lines)
    return f"{payload}\n"


def _to_sse_event(event: str, data: str) -> str:
    normalized = data.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")
    payload = "".join(f"data: {line}\n" for line in lines)
    return f"event: {event}\n{payload}\n"


def _latest_user_message(messages: list[dict[str, str]]) -> str:
    for item in reversed(messages):
        if item.get("role") == "user":
            text = (item.get("content") or "").strip()
            if text:
                return text
    return ""


async def _log_exchange_quietly(
    *,
    session_id: str,
    mode: str,
    user_message: str,
    system_response: str,
    db: AsyncSession,
) -> None:
    """Persist the audit trail without ever failing the user-facing chat."""
    try:
        await save_chat_exchange(
            session_id=session_id,
            mode=mode,
            user_message=user_message,
            system_response=system_response,
            db=db,
        )
    except Exception:
        # Do not fail user chat if audit logging fails.
        pass


async def _iter_chunks_with_heartbeat(messages: list[dict[str, str]], language: str | None = None):
    """Yield reply chunks, emitting `_HEARTBEAT` whenever the model stalls."""
    iterator = chat_stream(messages, language=language).__aiter__()
    pending_next = None
    try:
        while True:
            try:
                if pending_next is None:
                    pending_next = asyncio.create_task(anext(iterator))
                chunk = await asyncio.wait_for(
                    asyncio.shield(pending_next),
                    timeout=HEARTBEAT_INTERVAL_SECONDS,
                )
                pending_next = None
            except asyncio.TimeoutError:
                yield _HEARTBEAT
                continue
            except StopAsyncIteration:
                break
            yield chunk
    finally:
        if pending_next is not None:
            pending_next.cancel()


async def _stream_chat_events(
    messages: list[dict[str, str]],
    *,
    language: str | None,
    should_log: bool,
    session_id: str,
    mode: str,
    user_message: str,
    db: AsyncSession,
):
    """Render the streamed reply as SSE frames and log the finished exchange."""
    streamed_reply = ""
    try:
        async with aclosing(_iter_chunks_with_heartbeat(messages, language=language)) as chunks:
            async for chunk in chunks:
                if chunk is _HEARTBEAT:
                    yield _to_sse_event("heartbeat", "ping")
                    continue
                streamed_reply += chunk
                yield _to_sse_frame(chunk)

        if should_log and streamed_reply:
            await _log_exchange_quietly(
                session_id=session_id,
                mode=mode,
                user_message=user_message,
                system_response=streamed_reply,
                db=db,
            )
        yield _to_sse_event("done", "[DONE]")
    except Exception as exc:
        error = str(exc).replace("\n", " ")
        yield _to_sse_event("error", error)


@chat_router.post("", response_model=ChatResponse)
async def chatbot(
    request: ChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    stream: Annotated[bool, Query()] = False,
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    latest_user_message = _latest_user_message(messages)
    should_log = request.mode == "general_enquiry" and bool(latest_user_message)
    session_id = request.session_id or f"ge-{uuid.uuid4().hex}"
    mode = request.mode or "general_enquiry"

    if stream:
        return StreamingResponse(
            _stream_chat_events(
                messages,
                language=request.language,
                should_log=should_log,
                session_id=session_id,
                mode=mode,
                user_message=latest_user_message,
                db=db,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    reply = await chat(messages, language=request.language)
    if should_log:
        await _log_exchange_quietly(
            session_id=session_id,
            mode=mode,
            user_message=latest_user_message,
            system_response=reply,
            db=db,
        )
    return ChatResponse(reply=reply)


@acknowledgement_router.get(
    "/latest/{patient_id}",
    responses={404: {"description": "No record found for patient"}},
)
async def get_latest_acknowledgement(patient_id: str):
    mongo_db = mongo_module.get_mongo_db()
    doc = await mongo_db["TBL_PATIENT_RECORDS"].find_one(
        {"patient_id": patient_id},
        sort=[("issued", -1)],
    )
    if not doc:
        raise HTTPException(status_code=404, detail="No record found for patient")
    doc.pop("_id", None)
    return doc


@acknowledgement_router.post("", response_model=AcknowledgementResponse)
async def submit_acknowledgement(
    request: AcknowledgementRequest,
):
    mongo_db = mongo_module.get_mongo_db()

    record = await save_patient_acknowledgement(request.patient_record, mongo_db)

    return AcknowledgementResponse(
        record=record,
        message="Patient acknowledgement recorded successfully.",
    )
