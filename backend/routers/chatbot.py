# LLM chatbot endpoint — orchestrates UC1/UC2/UC3 via natural language
from fastapi import APIRouter
from pydantic import BaseModel
from services.llm_service import chat

router = APIRouter(prefix="/chat", tags=["Chatbot"])


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str


@router.post("", response_model=ChatResponse)
async def chatbot(request: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    reply = await chat(messages)
    return ChatResponse(reply=reply)
