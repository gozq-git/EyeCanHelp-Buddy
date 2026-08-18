import pytest

from services.chatbot import llm as llm_service

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


def test_extract_runtime_response_event_stream_json_encoded_chunks():
    response = {
        "contentType": "text/event-stream",
        "response": _StreamLines([
            b'data: "Hello\\n"',
            b'data: "World \\u26a0"',
        ]),
    }
    assert llm_service._extract_runtime_response(response) == "Hello\n\nWorld ⚠"


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


def test_extract_guardrail_output_message_prefers_outputs_text():
    response = {
        "outputs": [
            {"text": "Blocked by guardrail output."},
        ]
    }

    assert llm_service._extract_guardrail_output_message(response) == "Blocked by guardrail output."


def test_extract_guardrail_output_message_from_nested_content():
    response = {
        "outputs": [
            {
                "content": [
                    {"text": {"text": "Nested blocked message."}},
                ]
            }
        ]
    }

    assert llm_service._extract_guardrail_output_message(response) == "Nested blocked message."


@pytest.mark.asyncio
async def test_invoke_with_runtime_arn_returns_empty_when_not_configured(monkeypatch):
    monkeypatch.delenv("AGENTCORE_COORDINATOR_RUNTIME_ARN", raising=False)

    result = await llm_service._invoke_with_runtime_arn("hello")

    assert result == ""


@pytest.mark.asyncio
async def test_apply_guardrail_to_messages_returns_blocked_message(monkeypatch):
    monkeypatch.setenv("BEDROCK_GUARDRAIL_ID", "gr-123")
    monkeypatch.setenv("BEDROCK_GUARDRAIL_VERSION", "1")
    monkeypatch.setenv("AWS_REGION", "us-east-1")

    class _FakeClient:
        def apply_guardrail(self, **kwargs):
            assert kwargs["guardrailIdentifier"] == "gr-123"
            assert kwargs["guardrailVersion"] == "1"
            assert kwargs["source"] == "INPUT"
            assert kwargs["content"] == [{"text": {"text": "Unsafe request"}}]
            return {
                "action": "GUARDRAIL_INTERVENED",
                "outputs": [{"text": "Please rephrase your request."}],
            }

    monkeypatch.setattr(llm_service.boto3, "client", lambda service, region_name=None: _FakeClient())

    result = await llm_service.apply_guardrail_to_messages([
        {"role": "user", "content": "Unsafe request"},
    ])

    assert result == {"blocked": True, "message": "Please rephrase your request."}


@pytest.mark.asyncio
async def test_apply_guardrail_to_messages_raises_when_config_missing(monkeypatch):
    monkeypatch.delenv("BEDROCK_GUARDRAIL_ID", raising=False)
    monkeypatch.delenv("BEDROCK_GUARDRAIL_VERSION", raising=False)

    with pytest.raises(llm_service.GuardrailUnavailableError):
        await llm_service.apply_guardrail_to_messages([
            {"role": "user", "content": "hello"},
        ])


@pytest.mark.asyncio
async def test_apply_guardrail_to_messages_raises_on_client_error(monkeypatch):
    monkeypatch.setenv("BEDROCK_GUARDRAIL_ID", "gr-123")
    monkeypatch.setenv("BEDROCK_GUARDRAIL_VERSION", "1")

    class _FakeClient:
        def apply_guardrail(self, **kwargs):
            raise RuntimeError("bedrock down")

    monkeypatch.setattr(llm_service.boto3, "client", lambda service, region_name=None: _FakeClient())

    with pytest.raises(llm_service.GuardrailUnavailableError):
        await llm_service.apply_guardrail_to_messages([
            {"role": "user", "content": "hello"},
        ])


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


@pytest.mark.asyncio
async def test_chat_stream_yields_runtime_chunks(monkeypatch):
    class _StreamLines:
        def iter_lines(self, chunk_size=10):
            yield b"data: hello"
            yield b"data: world"

    async def _fake_runtime_response(prompt, stream=False):
        assert prompt == "USER: Hi"
        assert stream is True
        return {
            "contentType": "text/event-stream",
            "response": _StreamLines(),
        }

    monkeypatch.setattr(llm_service, "_invoke_with_runtime_arn_response", _fake_runtime_response)

    chunks = [chunk async for chunk in llm_service.chat_stream([{"role": "user", "content": "Hi"}])]

    assert chunks == ["hello", "world"]
