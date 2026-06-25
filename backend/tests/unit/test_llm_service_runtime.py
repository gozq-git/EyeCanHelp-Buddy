import pytest

from services import llm_service

pytestmark = pytest.mark.unit


class _StreamLines:
    def __init__(self, lines):
        self._lines = lines

    def iter_lines(self, chunk_size=10):
        for line in self._lines:
            yield line


class _Readable:
    def __init__(self, value):
        self._value = value

    def read(self):
        return self._value


def test_extract_runtime_response_event_stream():
    response = {
        "contentType": "text/event-stream",
        "response": _StreamLines([b"data: hello", b"data: world"]),
    }
    assert llm_service._extract_runtime_response(response) == "hello\nworld"


def test_extract_runtime_response_json_stream():
    response = {
        "contentType": "application/json",
        "response": [b'{"response": "ok"}'],
    }
    assert llm_service._extract_runtime_response(response) == "ok"


def test_extract_runtime_response_readable_fallback():
    response = {
        "contentType": "text/plain",
        "response": _Readable(b"plain text"),
    }
    assert llm_service._extract_runtime_response(response) == "plain text"


def test_extract_runtime_response_empty():
    assert llm_service._extract_runtime_response({"contentType": "text/plain"}) == ""


@pytest.mark.asyncio
async def test_invoke_with_runtime_arn_returns_empty_when_not_configured(monkeypatch):
    monkeypatch.delenv("AGENTCORE_COORDINATOR_RUNTIME_ARN", raising=False)

    result = await llm_service._invoke_with_runtime_arn("hello")

    assert result == ""


@pytest.mark.asyncio
async def test_chat_builds_prompt_and_uses_runtime(monkeypatch):
    called = {"prompt": None}

    async def _fake_invoke(prompt):
        called["prompt"] = prompt
        return "agent response"

    monkeypatch.setattr(llm_service, "_invoke_with_runtime_arn", _fake_invoke)

    result = await llm_service.chat([
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hello"},
    ])

    assert called["prompt"] == "USER: Hi\nASSISTANT: Hello"
    assert result == "agent response"


@pytest.mark.asyncio
async def test_invoke_with_http_endpoint_parses_json(monkeypatch):
    class _FakeResponse:
        headers = {"content-type": "application/json"}
        text = '{"response":"hello from http"}'

        def raise_for_status(self):
            return None

    class _FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, endpoint, json):
            assert endpoint == "http://127.0.0.1:8080/invocations"
            assert "prompt" in json
            return _FakeResponse()

    monkeypatch.setattr(llm_service.httpx, "AsyncClient", _FakeClient)

    text = await llm_service._invoke_with_http_endpoint("test prompt")

    assert text == "hello from http"
