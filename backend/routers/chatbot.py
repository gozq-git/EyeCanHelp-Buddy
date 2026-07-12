# LLM chatbot endpoint — orchestrates UC1/UC2/UC3 via natural language
import asyncio
import os

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.llm_service import chat, chat_stream

router = APIRouter(prefix="/chat", tags=["Chatbot"])


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str


HEARTBEAT_INTERVAL_SECONDS = float(os.getenv("CHAT_STREAM_HEARTBEAT_SECONDS", "10"))


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


@router.post("", response_model=ChatResponse)
async def chatbot(request: ChatRequest, stream: bool = Query(default=False)):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    if stream:
        async def event_generator():
            iterator = chat_stream(messages).__aiter__()
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
                        # Keep long-lived connections alive through intermediary proxies.
                        yield _to_sse_event("heartbeat", "ping")
                        continue
                    except StopAsyncIteration:
                        break
                    yield _to_sse_frame(chunk)
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
    return ChatResponse(reply=reply)
