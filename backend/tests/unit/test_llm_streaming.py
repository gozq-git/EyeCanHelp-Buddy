"""Unit tests for the AgentCore streaming/runtime paths in services/chatbot/llm.py.

Complements test_llm_service.py (which covers the pure text helpers) by driving
the pieces that consume a boto3 StreamingBody: SSE line streaming, chunked JSON
draining, whole-body reads, and the runtime invocation wrapper. boto3 is faked
throughout, so no AWS call is made.
"""
import json

import pytest

from services.chatbot import llm

pytestmark = pytest.mark.unit


class _FakeStreamingBody:
    """Stands in for botocore's StreamingBody."""

    def __init__(self, lines=None, chunks=None, body=None):
        self._lines = lines
        self._chunks = chunks
        self._body = body

    def iter_lines(self, chunk_size=None):
        return iter(self._lines)

    def __iter__(self):
        return iter(self._chunks)

    def read(self):
        return self._body


class _NoReadStream:
    """A stream object with none of the shapes _stream_runtime_response accepts."""


# ── _decode_chunk ─────────────────────────────────────────────────────────────
def test_decode_chunk_decodes_bytes():
    assert llm._decode_chunk(b"hello") == "hello"


def test_decode_chunk_stringifies_other_types():
    assert llm._decode_chunk(42) == "42"


# ── _decode_sse_payload ───────────────────────────────────────────────────────
def test_decode_sse_payload_returns_empty_for_blank():
    assert llm._decode_sse_payload("   ") == ""
    assert llm._decode_sse_payload(None) == ""


def test_decode_sse_payload_returns_raw_for_non_json():
    assert llm._decode_sse_payload("plain text") == "plain text"


def test_decode_sse_payload_unwraps_json_string():
    assert llm._decode_sse_payload('"a cataract"') == "a cataract"


@pytest.mark.parametrize("key", ["response", "text", "message", "error"])
def test_decode_sse_payload_prefers_known_dict_keys(key):
    assert llm._decode_sse_payload(json.dumps({key: "value"})) == "value"


def test_decode_sse_payload_reserialises_unknown_dicts():
    out = llm._decode_sse_payload('{"unexpected": "shape"}')

    assert json.loads(out) == {"unexpected": "shape"}


def test_decode_sse_payload_stringifies_other_json():
    assert llm._decode_sse_payload("[1, 2]") == "[1, 2]"


# ── _extract_json_text / _extract_runtime_response ────────────────────────────
def test_extract_json_text_returns_raw_for_dict_without_known_keys():
    assert llm._extract_json_text('{"other": 1}') == '{"other": 1}'


def test_extract_runtime_response_joins_sse_lines():
    response = {
        "contentType": llm.CONTENT_TYPE_SSE,
        "response": _FakeStreamingBody(lines=[b'data: "A cataract"', b"", b'data: " is cloudy"']),
    }

    assert llm._extract_runtime_response(response) == "A cataract\n is cloudy"


def test_extract_runtime_response_keeps_non_sse_prefixed_lines():
    response = {
        "contentType": llm.CONTENT_TYPE_SSE,
        "response": _FakeStreamingBody(lines=[b"raw line"]),
    }

    assert llm._extract_runtime_response(response) == "raw line"


def test_extract_runtime_response_reads_chunked_json():
    response = {
        "contentType": llm.CONTENT_TYPE_JSON,
        "response": _FakeStreamingBody(chunks=[b'{"response": "an ', b'answer"}']),
    }

    assert llm._extract_runtime_response(response) == "an answer"


def test_extract_runtime_response_falls_back_to_read():
    response = {"contentType": "text/plain", "response": _FakeStreamingBody(body=b"  plain  ")}

    assert llm._extract_runtime_response(response) == "plain"


def test_extract_runtime_response_returns_empty_without_a_stream():
    assert llm._extract_runtime_response({"contentType": llm.CONTENT_TYPE_SSE}) == ""


# ── _next_or_none / _chunk_text ───────────────────────────────────────────────
def test_next_or_none_returns_none_when_exhausted():
    iterator = iter(["only"])

    assert llm._next_or_none(iterator) == "only"
    assert llm._next_or_none(iterator) is None


def test_chunk_text_returns_empty_for_blank():
    assert llm._chunk_text("") == []


def test_chunk_text_splits_on_chunk_size():
    assert llm._chunk_text("abcdefg", chunk_size=3) == ["abc", "def", "g"]


# ── _stream_sse_lines ─────────────────────────────────────────────────────────
async def test_stream_sse_lines_decodes_and_skips_blanks():
    stream = _FakeStreamingBody(lines=[b'data: "A "', b"   ", b'data: "cataract"'])

    assert [chunk async for chunk in llm._stream_sse_lines(stream)] == ["A ", "cataract"]


async def test_stream_sse_lines_passes_through_unprefixed_lines():
    stream = _FakeStreamingBody(lines=[b"bare line"])

    assert [chunk async for chunk in llm._stream_sse_lines(stream)] == ["bare line"]


# ── _collect_json_stream ──────────────────────────────────────────────────────
async def test_collect_json_stream_joins_and_extracts():
    stream = _FakeStreamingBody(chunks=[b'{"response": "an ', b'answer"}'])

    assert await llm._collect_json_stream(stream) == "an answer"


async def test_collect_json_stream_handles_empty_body():
    assert await llm._collect_json_stream(_FakeStreamingBody(chunks=[])) == ""


# ── _read_whole_stream ────────────────────────────────────────────────────────
async def test_read_whole_stream_strips_body():
    assert await llm._read_whole_stream(_FakeStreamingBody(body=b"  text  ")) == "text"


async def test_read_whole_stream_handles_empty_body():
    assert await llm._read_whole_stream(_FakeStreamingBody(body=b"")) == ""


# ── _stream_runtime_response ──────────────────────────────────────────────────
async def test_stream_runtime_response_yields_nothing_without_a_stream():
    response = {"contentType": llm.CONTENT_TYPE_SSE, "response": None}

    assert [c async for c in llm._stream_runtime_response(response)] == []


async def test_stream_runtime_response_streams_sse():
    response = {
        "contentType": llm.CONTENT_TYPE_SSE,
        "response": _FakeStreamingBody(lines=[b'data: "A cataract"']),
    }

    assert [c async for c in llm._stream_runtime_response(response)] == ["A cataract"]


async def test_stream_runtime_response_chunks_json_replies():
    response = {
        "contentType": llm.CONTENT_TYPE_JSON,
        "response": _FakeStreamingBody(chunks=[json.dumps({"response": "abcdefgh"}).encode()]),
    }

    out = [c async for c in llm._stream_runtime_response(response)]

    assert "".join(out) == "abcdefgh"


async def test_stream_runtime_response_chunks_whole_body_replies():
    response = {"contentType": "text/plain", "response": _FakeStreamingBody(body=b"plain body")}

    out = [c async for c in llm._stream_runtime_response(response)]

    assert "".join(out) == "plain body"


async def test_stream_runtime_response_yields_nothing_for_unusable_stream():
    response = {"contentType": "text/plain", "response": _NoReadStream()}

    assert [c async for c in llm._stream_runtime_response(response)] == []


# ── _invoke_with_runtime_arn_response ─────────────────────────────────────────
class _FakeAgentCoreClient:
    def __init__(self, response):
        self._response = response
        self.calls = []

    def invoke_agent_runtime(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


@pytest.fixture
def fake_agentcore(monkeypatch):
    def _install(response):
        client = _FakeAgentCoreClient(response)
        monkeypatch.setattr(llm.boto3, "client", lambda *a, **kw: client)
        return client

    return _install


async def test_invoke_with_runtime_arn_response_returns_none_without_arn(monkeypatch):
    monkeypatch.delenv("AGENTCORE_COORDINATOR_RUNTIME_ARN", raising=False)

    assert await llm._invoke_with_runtime_arn_response("hi") is None


async def test_invoke_with_runtime_arn_response_passes_the_payload(monkeypatch, fake_agentcore):
    arn = "arn:aws:bedrock-agentcore:ap-southeast-1:123456789012:runtime/test"
    monkeypatch.setenv("AGENTCORE_COORDINATOR_RUNTIME_ARN", arn)
    monkeypatch.setenv("AGENTCORE_RUNTIME_SESSION_ID", "session-1")
    monkeypatch.delenv("AWS_REGION", raising=False)
    client = fake_agentcore({"contentType": llm.CONTENT_TYPE_JSON})

    out = await llm._invoke_with_runtime_arn_response("a prompt", stream=True)

    assert out == {"contentType": llm.CONTENT_TYPE_JSON}
    call = client.calls[0]
    assert call["agentRuntimeArn"] == arn
    assert call["runtimeSessionId"] == "session-1"
    assert json.loads(call["payload"]) == {"prompt": "a prompt", "stream": True}


async def test_invoke_with_runtime_arn_generates_a_session_id(monkeypatch, fake_agentcore):
    monkeypatch.setenv(
        "AGENTCORE_COORDINATOR_RUNTIME_ARN",
        "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test",
    )
    monkeypatch.delenv("AGENTCORE_RUNTIME_SESSION_ID", raising=False)
    client = fake_agentcore({})

    await llm._invoke_with_runtime_arn_response("hi")

    assert client.calls[0]["runtimeSessionId"]


async def test_invoke_with_runtime_arn_returns_empty_without_a_response(monkeypatch):
    monkeypatch.delenv("AGENTCORE_COORDINATOR_RUNTIME_ARN", raising=False)

    assert await llm._invoke_with_runtime_arn("hi") == ""


async def test_invoke_with_runtime_arn_extracts_the_reply(monkeypatch, fake_agentcore):
    monkeypatch.setenv(
        "AGENTCORE_COORDINATOR_RUNTIME_ARN",
        "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test",
    )
    fake_agentcore(
        {
            "contentType": llm.CONTENT_TYPE_SSE,
            "response": _FakeStreamingBody(lines=[b'data: "the reply"']),
        }
    )

    assert await llm._invoke_with_runtime_arn("hi") == "the reply"


# ── chat / chat_stream ────────────────────────────────────────────────────────
async def test_chat_falls_back_to_http_endpoint(monkeypatch):
    async def _no_runtime(_prompt):
        return ""

    async def _http(_prompt):
        return "http reply"

    monkeypatch.setattr(llm, "_invoke_with_runtime_arn", _no_runtime)
    monkeypatch.setattr(llm, "_invoke_with_http_endpoint", _http)

    assert await llm.chat([{"role": "user", "content": "hi"}]) == "http reply"


async def test_chat_reports_when_both_paths_are_silent(monkeypatch):
    async def _empty(_prompt):
        return ""

    monkeypatch.setattr(llm, "_invoke_with_runtime_arn", _empty)
    monkeypatch.setattr(llm, "_invoke_with_http_endpoint", _empty)

    assert await llm.chat([]) == "No response returned from coordinator runtime."


async def test_chat_stream_yields_nothing_without_a_runtime(monkeypatch):
    async def _none(_prompt, stream=False):
        return None

    monkeypatch.setattr(llm, "_invoke_with_runtime_arn_response", _none)

    assert [c async for c in llm.chat_stream([])] == []


async def test_chat_stream_yields_runtime_chunks(monkeypatch):
    async def _response(_prompt, stream=False):
        return {
            "contentType": llm.CONTENT_TYPE_SSE,
            "response": _FakeStreamingBody(lines=[b'data: "A "', b'data: "cataract"']),
        }

    monkeypatch.setattr(llm, "_invoke_with_runtime_arn_response", _response)

    assert [c async for c in llm.chat_stream([])] == ["A ", "cataract"]
