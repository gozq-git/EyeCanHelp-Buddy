"""Unit tests for the coordinator's shared Bedrock helpers (agents/coordinator/llm.py).

Bedrock is never contacted: `boto3.client` is swapped for a fake whose
`converse_stream` / `converse` return canned payloads.
"""
import sys
from pathlib import Path

import pytest

COORDINATOR_DIR = Path(__file__).resolve().parents[2] / "agents" / "coordinator"
if str(COORDINATOR_DIR) not in sys.path:
    # Append so backend/main.py keeps precedence for `import main`.
    sys.path.append(str(COORDINATOR_DIR))

import llm as coordinator_llm

pytestmark = pytest.mark.unit


def _delta(text):
    return {"contentBlockDelta": {"delta": {"text": text}}}


class _FakeBedrockClient:
    def __init__(self, stream=None, converse_output=None, raises=None):
        self._stream = stream
        self._converse_output = converse_output or []
        self._raises = raises
        self.calls = []

    def converse_stream(self, **kwargs):
        self.calls.append(("converse_stream", kwargs))
        if self._raises:
            raise self._raises
        return {"stream": self._stream}

    def converse(self, **kwargs):
        self.calls.append(("converse", kwargs))
        return {"output": {"message": {"content": self._converse_output}}}


@pytest.fixture
def fake_client(monkeypatch):
    """Install a fake bedrock-runtime client and hand the test a setter for it."""
    holder = {}

    def _install(**kwargs):
        client = _FakeBedrockClient(**kwargs)
        monkeypatch.setattr(coordinator_llm.boto3, "client", lambda *a, **kw: client)
        holder["client"] = client
        return client

    return _install


# ── _build_converse_args ──────────────────────────────────────────────────────
def test_build_converse_args_shapes_the_bedrock_payload():
    args = coordinator_llm._build_converse_args("sys prompt", "user prompt", 0.5)

    assert args["system"] == [{"text": "sys prompt"}]
    assert args["messages"] == [{"role": "user", "content": [{"text": "user prompt"}]}]
    assert args["inferenceConfig"] == {"temperature": 0.5}


# ── _collect_stream_text ──────────────────────────────────────────────────────
def test_collect_stream_text_returns_empty_when_no_stream():
    assert coordinator_llm._collect_stream_text({}) == ""


def test_collect_stream_text_joins_deltas_and_skips_non_dict_events():
    response = {"stream": [_delta("Hello "), "not-a-dict", {"other": 1}, _delta("world")]}

    assert coordinator_llm._collect_stream_text(response) == "Hello world"


def test_collect_stream_text_ignores_non_dict_delta():
    response = {"stream": [{"contentBlockDelta": {"delta": "oops"}}]}

    assert coordinator_llm._collect_stream_text(response) == ""


# ── invoke_model_stream ───────────────────────────────────────────────────────
def test_invoke_model_stream_yields_text_deltas(fake_client):
    fake_client(stream=[_delta("A"), "skip", _delta("B")])

    assert list(coordinator_llm.invoke_model_stream("sys", "user")) == ["A", "B"]


def test_invoke_model_stream_yields_nothing_when_stream_missing(fake_client):
    fake_client(stream=None)

    assert list(coordinator_llm.invoke_model_stream("sys", "user")) == []


def test_invoke_model_stream_reports_errors_as_text(fake_client):
    fake_client(raises=RuntimeError("bedrock down"))

    out = list(coordinator_llm.invoke_model_stream("sys", "user"))

    assert len(out) == 1
    assert "could not generate a model response" in out[0]
    assert "bedrock down" in out[0]


# ── invoke_model ──────────────────────────────────────────────────────────────
def test_invoke_model_returns_aggregated_stream_text(fake_client):
    client = fake_client(stream=[_delta("Grounded "), _delta("answer")])

    assert coordinator_llm.invoke_model("sys", "user") == "Grounded answer"
    # The streaming API is preferred, so no converse() fallback should happen.
    assert [name for name, _ in client.calls] == ["converse_stream"]


def test_invoke_model_falls_back_to_converse_when_stream_is_empty(fake_client):
    client = fake_client(stream=[], converse_output=[{"text": " first "}, {"text": "second"}])

    assert coordinator_llm.invoke_model("sys", "user") == "first\nsecond"
    assert [name for name, _ in client.calls] == ["converse_stream", "converse"]


def test_invoke_model_skips_non_dict_content_in_fallback(fake_client):
    fake_client(stream=[], converse_output=[{"text": "kept"}, "dropped"])

    assert coordinator_llm.invoke_model("sys", "user") == "kept"


def test_invoke_model_returns_placeholder_when_everything_is_empty(fake_client):
    fake_client(stream=[], converse_output=[])

    assert coordinator_llm.invoke_model("sys", "user") == "No response returned from Bedrock model."


def test_invoke_model_reports_errors_as_text(fake_client):
    fake_client(raises=RuntimeError("no credentials"))

    out = coordinator_llm.invoke_model("sys", "user")

    assert "could not generate a model response" in out
    assert "no credentials" in out


def test_invoke_model_honours_model_and_temperature_env(monkeypatch, fake_client):
    monkeypatch.setenv("BEDROCK_MODEL_ID", "test.model")
    monkeypatch.setenv("BEDROCK_TEMPERATURE", "0.9")
    client = fake_client(stream=[_delta("ok")])

    coordinator_llm.invoke_model("sys", "user")

    _name, kwargs = client.calls[0]
    assert kwargs["modelId"] == "test.model"
    assert kwargs["inferenceConfig"] == {"temperature": 0.9}


# ── extract_latest_user_input ─────────────────────────────────────────────────
def test_extract_latest_user_input_returns_last_user_line():
    transcript = "SYSTEM: be helpful\nUSER: first\nASSISTANT: reply\nUSER: second question"

    assert coordinator_llm.extract_latest_user_input(transcript) == "second question"


def test_extract_latest_user_input_falls_back_to_whole_prompt():
    assert coordinator_llm.extract_latest_user_input("just a bare prompt") == "just a bare prompt"


def test_extract_latest_user_input_handles_empty_prompt():
    assert coordinator_llm.extract_latest_user_input("") == ""
    assert coordinator_llm.extract_latest_user_input(None) == ""
