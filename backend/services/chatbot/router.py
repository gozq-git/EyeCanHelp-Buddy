import asyncio
import inspect
import os
import uuid
from contextlib import aclosing
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database.postgres import get_db
import database.mongo as mongo_module
from .llm import GuardrailUnavailableError, apply_guardrail_to_messages
from .masking import mask_messages, mask_sensitive_text
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
GUARDRAIL_FAILURE_MESSAGE = (
    "Sorry, we are unable to process your input at the moment. Please try again later."
)
GUARDRAIL_FAILURE_MESSAGES = {
    "en": GUARDRAIL_FAILURE_MESSAGE,
    "zh": "抱歉，我们暂时无法处理您的输入。请稍后重试。",
    "ms": "Maaf, kami tidak dapat memproses input anda buat masa ini. Sila cuba lagi kemudian.",
    "ta": "மன்னிக்கவும், தற்போது உங்கள் உள்ளீட்டைச் செயலாக்க முடியவில்லை. பின்னர் மீண்டும் முயற்சிக்கவும்.",
}
GUARDRAIL_BLOCKED_DEFAULT_MESSAGE = "Your request could not be processed."
GUARDRAIL_BLOCKED_MESSAGES = {
    "zh": "抱歉，我们无法处理您提供的输入。请检查您的输入，确保未包含任何敏感信息或有害、冒犯性或不适当的语言，然后重试。",
    "ms": "Maaf, kami tidak dapat memproses input anda seperti yang diberikan. Sila semak input anda dan pastikan ia tidak mengandungi sebarang maklumat sensitif atau bahasa yang berbahaya, menyinggung perasaan atau tidak wajar, kemudian cuba lagi.",
    "ta": "மன்னிக்கவும், நீங்கள் வழங்கிய உள்ளீட்டைச் செயலாக்க முடியவில்லை. உங்கள் உள்ளீட்டில் எந்த உணர்திறன் தகவலும் அல்லது தீங்கிழைக்கும், புண்படுத்தும் அல்லது பொருத்தமற்ற மொழியும் இல்லை என்பதை உறுதிப்படுத்திய பிறகு மீண்டும் முயற்சிக்கவும்.",
}


def _normalize_language(language: str | None) -> str:
    value = (language or "").strip().lower()
    return value if value in {"en", "zh", "ms", "ta"} else "en"


def _guardrail_failure_message(language: str | None) -> str:
    return GUARDRAIL_FAILURE_MESSAGES.get(
        _normalize_language(language), GUARDRAIL_FAILURE_MESSAGE
    )


def _guardrail_blocked_message(guardrail_message: str, language: str | None) -> str:
    """Return the blocked notice in the user's language.

    The Bedrock guardrail's configured blocked message is English-only, so
    for non-English requests we substitute a localized equivalent. For
    English we keep the guardrail-provided text when available.
    """
    normalized = _normalize_language(language)
    if normalized == "en":
        return guardrail_message or GUARDRAIL_BLOCKED_DEFAULT_MESSAGE
    return GUARDRAIL_BLOCKED_MESSAGES.get(normalized, guardrail_message) or (
        guardrail_message or GUARDRAIL_BLOCKED_DEFAULT_MESSAGE
    )


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
            user_message=mask_sensitive_text(user_message),
            system_response=mask_sensitive_text(system_response),
            db=db,
        )
    except Exception:
        # Do not fail user chat if audit logging fails.
        pass


def _accepts_language_arg(fn) -> bool:
    """Return True when callable supports a `language` keyword argument."""
    try:
        signature = inspect.signature(fn)
    except (TypeError, ValueError):
        return False

    for param in signature.parameters.values():
        if param.kind == inspect.Parameter.VAR_KEYWORD:
            return True
    return "language" in signature.parameters


async def _call_chat(messages: list[dict[str, str]], language: str | None):
    if _accepts_language_arg(chat):
        return await chat(messages, language=language)
    return await chat(messages)


def _iter_chat_stream(messages: list[dict[str, str]], language: str | None):
    if _accepts_language_arg(chat_stream):
        return chat_stream(messages, language=language)
    return chat_stream(messages)


async def _iter_chunks_with_heartbeat(messages: list[dict[str, str]], language: str | None = None):
    """Yield reply chunks, emitting `_HEARTBEAT` whenever the model stalls."""
    iterator = _iter_chat_stream(messages, language=language).__aiter__()
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
    mode = request.mode or "general_enquiry"
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    if mode == "general_enquiry":
        messages = mask_messages(messages)
        try:
            guardrail_result = await apply_guardrail_to_messages(messages)
        except GuardrailUnavailableError as exc:
            raise HTTPException(
                status_code=503,
                detail=_guardrail_failure_message(request.language),
            ) from exc

        if guardrail_result.get("blocked"):
            blocked_message = _guardrail_blocked_message(
                str(guardrail_result.get("message") or "").strip(),
                request.language,
            )
            raise HTTPException(status_code=400, detail=blocked_message)

    latest_user_message = _latest_user_message(messages)
    session_id = request.session_id or f"ge-{uuid.uuid4().hex}"
    should_log = mode == "general_enquiry" and bool(latest_user_message)

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

    reply = await _call_chat(messages, language=request.language)
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
