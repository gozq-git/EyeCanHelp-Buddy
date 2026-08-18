"""Integration tests for the chatbot endpoint with the LLM/AgentCore call mocked."""
import asyncio

import pytest
from sqlalchemy import select

from services.chatbot.llm import GuardrailUnavailableError
from services.chatbot.model import ChatExchangeLog

pytestmark = pytest.mark.integration


def test_chat_returns_mocked_reply(client, monkeypatch):
    async def fake_chat(messages):
        # Confirm the router forwards the conversation as a list of dicts.
        assert isinstance(messages, list)
        assert messages[-1]["content"] == "What is a cataract?"
        return "A cataract is a clouding of the eye's lens."

    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)
    monkeypatch.setattr(
        "services.chatbot.router.apply_guardrail_to_messages",
        lambda messages: asyncio.sleep(0, result={"blocked": False, "message": ""}),
    )

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
    monkeypatch.setattr(
        "services.chatbot.router.apply_guardrail_to_messages",
        lambda messages: asyncio.sleep(0, result={"blocked": False, "message": ""}),
    )

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


def test_chat_masks_sensitive_input_before_routing_and_logging(client, monkeypatch, sqlite_sessionmaker):
    async def fake_chat(messages):
        assert messages[-1]["content"] == "Call me at +65******67 on 2*-0*-19**"
        return "Captured: Call me at +65******67 on 2*-0*-19**"

    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)
    monkeypatch.setattr(
        "services.chatbot.router.apply_guardrail_to_messages",
        lambda messages: asyncio.sleep(0, result={"blocked": False, "message": ""}),
    )

    resp = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "Call me at +6591234567 on 25-03-1965"}],
            "mode": "general_enquiry",
            "session_id": "sess-mask-001",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"reply": "Captured: Call me at +65******67 on 2*-0*-19**"}

    async def _fetch_logs():
        async with sqlite_sessionmaker() as session:
            result = await session.execute(
                select(ChatExchangeLog).where(ChatExchangeLog.session_id == "sess-mask-001")
            )
            return result.scalars().all()

    logs = asyncio.run(_fetch_logs())
    assert len(logs) == 1
    assert logs[0].user_message == "Call me at +65******67 on 2*-0*-19**"
    assert logs[0].system_response == "Captured: Call me at +65******67 on 2*-0*-19**"


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


def test_chat_does_not_mask_non_general_mode_messages(client, monkeypatch):
    async def fake_chat(messages):
        assert messages[-1]["content"] == "Call me at +6591234567 on 25-03-1965"
        return "ok"

    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)

    resp = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "Call me at +6591234567 on 25-03-1965"}],
            "mode": "post_operation",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"reply": "ok"}


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
    monkeypatch.setattr(
        "services.chatbot.router.apply_guardrail_to_messages",
        lambda messages: asyncio.sleep(0, result={"blocked": False, "message": ""}),
    )

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
    monkeypatch.setattr(
        "services.chatbot.router.apply_guardrail_to_messages",
        lambda messages: asyncio.sleep(0, result={"blocked": False, "message": ""}),
    )

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


def test_chat_general_enquiry_blocked_returns_guardrail_message_and_skips_chat(client, monkeypatch):
    async def fake_guardrail(messages):
        return {"blocked": True, "message": "Please remove sensitive medical details."}

    async def fake_chat(messages):
        raise AssertionError("chat should not be called when guardrail blocks")

    monkeypatch.setattr("services.chatbot.router.apply_guardrail_to_messages", fake_guardrail)
    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)

    resp = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "Some blocked content"}],
            "mode": "general_enquiry",
        },
    )

    assert resp.status_code == 400
    assert resp.json() == {"detail": "Please remove sensitive medical details."}


def test_chat_general_enquiry_guardrail_failure_returns_exact_fallback_and_skips_chat(client, monkeypatch):
    async def fake_guardrail(messages):
        raise GuardrailUnavailableError("upstream failure")

    async def fake_chat(messages):
        raise AssertionError("chat should not be called when guardrail fails")

    monkeypatch.setattr("services.chatbot.router.apply_guardrail_to_messages", fake_guardrail)
    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)

    resp = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "mode": "general_enquiry",
        },
    )

    assert resp.status_code == 503
    assert resp.json() == {
        "detail": "Sorry, we are unable to process your input at the moment. Please try again later."
    }


def test_chat_stream_blocked_returns_json_error_without_sse(client, monkeypatch):
    async def fake_guardrail(messages):
        return {"blocked": True, "message": "Blocked by policy."}

    monkeypatch.setattr("services.chatbot.router.apply_guardrail_to_messages", fake_guardrail)

    resp = client.post(
        "/api/chat?stream=true",
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "mode": "general_enquiry",
        },
    )

    assert resp.status_code == 400
    assert "application/json" in resp.headers.get("content-type", "")
    assert resp.json() == {"detail": "Blocked by policy."}


def test_chat_non_general_mode_bypasses_guardrail(client, monkeypatch):
    async def fake_guardrail(messages):
        raise AssertionError("guardrail should not run for non-general mode")

    async def fake_chat(messages):
        return "ok"

    monkeypatch.setattr("services.chatbot.router.apply_guardrail_to_messages", fake_guardrail)
    monkeypatch.setattr("services.chatbot.router.chat", fake_chat)

    resp = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "mode": "post_operation",
        },
    )

    assert resp.status_code == 200
    assert resp.json() == {"reply": "ok"}
