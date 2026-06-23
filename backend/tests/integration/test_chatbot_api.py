"""Integration tests for the chatbot endpoint with the LLM/AgentCore call mocked."""
import pytest

pytestmark = pytest.mark.integration


def test_chat_returns_mocked_reply(client, monkeypatch):
    async def fake_chat(messages):
        # Confirm the router forwards the conversation as a list of dicts.
        assert isinstance(messages, list)
        assert messages[-1]["content"] == "What is a cataract?"
        return "A cataract is a clouding of the eye's lens."

    monkeypatch.setattr("routers.chatbot.chat", fake_chat)

    resp = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "What is a cataract?"}]},
    )
    assert resp.status_code == 200
    assert resp.json() == {"reply": "A cataract is a clouding of the eye's lens."}


def test_chat_rejects_malformed_body(client):
    resp = client.post("/api/chat", json={"messages": "not-a-list"})
    assert resp.status_code == 422
