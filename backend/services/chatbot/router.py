import asyncio
import os
import uuid

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
from .service import chat, chat_stream, save_patient_acknowledgement, save_payment
from .service import save_chat_exchange

chat_router = APIRouter(prefix="/chat", tags=["Chatbot"])
acknowledgement_router = APIRouter(prefix="/acknowledgement", tags=["Acknowledgement"])

HEARTBEAT_INTERVAL_SECONDS = float(os.getenv("CHAT_STREAM_HEARTBEAT_SECONDS", "1"))


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


@chat_router.post("", response_model=ChatResponse)
async def chatbot(
    request: ChatRequest,
    stream: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    latest_user_message = _latest_user_message(messages)
    should_log = request.mode == "general_enquiry" and bool(latest_user_message)
    session_id = request.session_id or f"ge-{uuid.uuid4().hex}"

    if stream:
        async def event_generator():
            iterator = chat_stream(messages).__aiter__()
            pending_next = None
            streamed_reply = ""
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
                        yield _to_sse_event("heartbeat", "ping")
                        continue
                    except StopAsyncIteration:
                        break
                    streamed_reply += chunk
                    yield _to_sse_frame(chunk)

                if should_log and streamed_reply:
                    try:
                        await save_chat_exchange(
                            session_id=session_id,
                            mode=request.mode or "general_enquiry",
                            user_message=latest_user_message,
                            system_response=streamed_reply,
                            db=db,
                        )
                    except Exception:
                        # Do not fail user chat if audit logging fails.
                        pass
                yield "event: done\ndata: [DONE]\n\n"
            except Exception as exc:
                error = str(exc).replace("\n", " ")
                yield f"event: error\ndata: {error}\n\n"
            finally:
                if pending_next is not None:
                    pending_next.cancel()

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    reply = await chat(messages)
    if should_log:
        try:
            await save_chat_exchange(
                session_id=session_id,
                mode=request.mode or "general_enquiry",
                user_message=latest_user_message,
                system_response=reply,
                db=db,
            )
        except Exception:
            # Do not fail user chat if audit logging fails.
            pass
    return ChatResponse(reply=reply)


@acknowledgement_router.get("/latest/{patient_id}")
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
    db: AsyncSession = Depends(get_db),
):
    mongo_db = mongo_module.get_mongo_db()

    record = await save_patient_acknowledgement(request.patient_record, mongo_db)
    payment = await save_payment(request.payment, db)

    return AcknowledgementResponse(
        record=record,
        payment=payment,
        message="Patient acknowledgement recorded successfully.",
    )
