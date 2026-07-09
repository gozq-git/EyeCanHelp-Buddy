# LLM chatbot endpoint — orchestrates UC1/UC2/UC3 via natural language
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


def _to_sse_frame(chunk: str) -> str:
    normalized = chunk.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")
    payload = "".join(f"data: {line}\n" for line in lines)
    return f"{payload}\n"


@router.post("", response_model=ChatResponse)
async def chatbot(request: ChatRequest, stream: bool = Query(default=False)):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    if stream:
        async def event_generator():
            try:
                async for chunk in chat_stream(messages):
                    yield _to_sse_frame(chunk)
                yield "event: done\ndata: [DONE]\n\n"
            except Exception as exc:
                error = str(exc).replace("\n", " ")
                yield f"event: error\ndata: {error}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    reply = await chat(messages)
    return ChatResponse(reply=reply)
