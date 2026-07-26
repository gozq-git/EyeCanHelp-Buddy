"""Integration tests for the chatbot endpoint with the LLM/AgentCore call mocked."""
import asyncio

import pytest
from sqlalchemy import select

from services.chatbot.model import ChatExchangeLog

pytestmark = pytest.mark.integration


def test_chat_returns_mocked_reply(client, monkeypatch):
    async def fake_chat(messages):
        # Confirm the router forwards the conversation as a list of dicts.
        assert isinstance(messages, list)
        assert messages[-1]["content"] == "What is a cataract?"
        return "A cataract is a clouding of the eye's lens."

    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)

    resp = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "What is a cataract?"}]},
    )
    assert resp.status_code == 200
    assert resp.json() == {"reply": "A cataract is a clouding of the eye's lens."}


def test_chat_logs_general_enquiry_exchange_with_session_id(client, monkeypatch, sqlite_sessionmaker):
    async def fake_chat(messages):
        return "A cataract is a clouding of the eye's lens."

    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)

    resp = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "What is a cataract?"}],
            "mode": "general_enquiry",
            "session_id": "sess-general-001",
        },
    )
    assert resp.status_code == 200

    async def _fetch_logs():
        async with sqlite_sessionmaker() as session:
            result = await session.execute(
                select(ChatExchangeLog).where(ChatExchangeLog.session_id == "sess-general-001")
            )
            return result.scalars().all()

    logs = asyncio.run(_fetch_logs())
    assert len(logs) == 1
    assert logs[0].mode == "general_enquiry"
    assert logs[0].user_message == "What is a cataract?"
    assert logs[0].system_response == "A cataract is a clouding of the eye's lens."


def test_chat_does_not_log_non_general_mode(client, monkeypatch, sqlite_sessionmaker):
    async def fake_chat(messages):
        return "ok"

    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)

    resp = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "What is a cataract?"}],
            "mode": "post_operation",
            "session_id": "sess-postop-001",
        },
    )
    assert resp.status_code == 200

    async def _fetch_logs():
        async with sqlite_sessionmaker() as session:
            result = await session.execute(
                select(ChatExchangeLog).where(ChatExchangeLog.session_id == "sess-postop-001")
            )
            return result.scalars().all()

    logs = asyncio.run(_fetch_logs())
    assert logs == []


def test_chat_rejects_malformed_body(client):
    resp = client.post("/api/chat", json={"messages": "not-a-list"})
    assert resp.status_code == 422


def test_chat_stream_returns_sse_frames(client, monkeypatch):
    async def fake_chat_stream(messages):
        assert isinstance(messages, list)
        assert messages[-1]["content"] == "What is a cataract?"
        yield "A cataract"
        yield " is a clouding"

    monkeypatch.setattr("services.chatbot.router.chat_stream", fake_chat_stream)

    with client.stream(
        "POST",
        "/api/chat?stream=true",
        json={"messages": [{"role": "user", "content": "What is a cataract?"}]},
    ) as resp:
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
        body = "".join(resp.iter_text())

    assert "data: A cataract" in body
    assert "data:  is a clouding" in body
    assert "event: done" in body
    assert "data: [DONE]" in body


def test_chat_stream_emits_heartbeat_events(client, monkeypatch):
    async def fake_chat_stream(messages):
        assert isinstance(messages, list)
        await asyncio.sleep(0.03)
        yield "token"

    monkeypatch.setattr("services.chatbot.router.chat_stream", fake_chat_stream)
    monkeypatch.setattr("services.chatbot.router.HEARTBEAT_INTERVAL_SECONDS", 0.01)

    with client.stream(
        "POST",
        "/api/chat?stream=true",
        json={"messages": [{"role": "user", "content": "What is a cataract?"}]},
    ) as resp:
        assert resp.status_code == 200
        body = "".join(resp.iter_text())

    assert "event: heartbeat" in body
    assert "data: ping" in body
    assert "data: token" in body
