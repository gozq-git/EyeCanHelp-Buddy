"""Unit tests for the AgentCore entrypoint (agents/coordinator/main.py).

Loaded by file path under a distinct module name: `backend/main.py` also exists
and owns the plain `main` import, so `importlib` is used to reach the
coordinator's own entrypoint without shadowing it.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

COORDINATOR_DIR = Path(__file__).resolve().parents[2] / "agents" / "coordinator"
if str(COORDINATOR_DIR) not in sys.path:
    # Append so backend/main.py keeps precedence for `import main`.
    sys.path.append(str(COORDINATOR_DIR))

# `BedrockAgentCoreApp` only became a top-level export in bedrock-agentcore 0.1.0;
# requirements-dev.txt pins that version for exactly this reason. Degrade to a
# reported skip rather than a collection error if the pin ever drifts.
pytest.importorskip(
    "bedrock_agentcore",
    reason="bedrock-agentcore is required to import the coordinator entrypoint",
)
if not hasattr(__import__("bedrock_agentcore"), "BedrockAgentCoreApp"):
    pytest.skip(
        "installed bedrock-agentcore predates the top-level BedrockAgentCoreApp export",
        allow_module_level=True,
    )


def _load_coordinator_main():
    spec = importlib.util.spec_from_file_location(
        "coordinator_entrypoint", COORDINATOR_DIR / "main.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


coordinator_main = _load_coordinator_main()

pytestmark = pytest.mark.unit


class _StubSpecialist:
    def __init__(self, tokens):
        self.name = "healthcare"
        self._tokens = tokens

    def handle_stream(self, _state):
        yield from self._tokens


async def _drain(agen):
    return [chunk async for chunk in agen]


# ── invoke: non-streaming ─────────────────────────────────────────────────────
async def test_invoke_returns_workflow_response(monkeypatch):
    seen = {}

    class _FakeWorkflow:
        def invoke(self, state):
            seen["state"] = state
            return {"response": "  A cataract is a clouding of the lens.  "}

    monkeypatch.setattr(coordinator_main, "workflow", _FakeWorkflow())

    out = await coordinator_main.invoke({"prompt": "USER: what is a cataract?"})

    assert out == {
        "status": "success",
        "agent": "coordinator",
        "response": "A cataract is a clouding of the lens.",
    }
    assert seen["state"] == {"prompt": "USER: what is a cataract?"}


async def test_invoke_uses_hello_default_without_payload(monkeypatch):
    seen = {}

    class _FakeWorkflow:
        def invoke(self, state):
            seen["state"] = state
            return {"response": "hi"}

    monkeypatch.setattr(coordinator_main, "workflow", _FakeWorkflow())

    await coordinator_main.invoke(None)

    assert seen["state"] == {"prompt": "Hello"}


@pytest.mark.parametrize(
    "payload,expected",
    [
        # An empty dict is falsy, so it takes the bare "Hello" branch; only a
        # truthy payload missing "prompt" reaches the longer .get() default.
        ({}, "Hello"),
        ({"stream": False}, "Hello, what can you help me with?"),
    ],
)
async def test_invoke_prompt_defaults(monkeypatch, payload, expected):
    seen = {}

    class _FakeWorkflow:
        def invoke(self, state):
            seen["state"] = state
            return {"response": "hi"}

    monkeypatch.setattr(coordinator_main, "workflow", _FakeWorkflow())

    await coordinator_main.invoke(payload)

    assert seen["state"] == {"prompt": expected}


async def test_invoke_reports_errors_as_status_error(monkeypatch):
    class _ExplodingWorkflow:
        def invoke(self, _state):
            raise RuntimeError("graph blew up")

    monkeypatch.setattr(coordinator_main, "workflow", _ExplodingWorkflow())

    out = await coordinator_main.invoke({"prompt": "hi"})

    assert out == {"status": "error", "agent": "coordinator", "error": "graph blew up"}


# ── invoke: streaming ─────────────────────────────────────────────────────────
async def test_invoke_streams_specialist_tokens(monkeypatch):
    monkeypatch.setattr(
        coordinator_main, "route_request", lambda _q: {"route": "healthcare", "kb_query": "cataract"}
    )
    monkeypatch.setattr(
        coordinator_main, "get_specialist_by_name", lambda _n: _StubSpecialist(["A ", "cataract", ""])
    )

    stream = await coordinator_main.invoke({"prompt": "USER: cataract?", "stream": True})

    assert await _drain(stream) == ["A ", "cataract"]


async def test_invoke_streams_escalation_response(monkeypatch):
    monkeypatch.setattr(
        coordinator_main,
        "route_request",
        lambda _q: {"route": "escalate", "response": "  Please call the hotline.  "},
    )

    stream = await coordinator_main.invoke({"prompt": "USER: pus", "stream": True})

    assert await _drain(stream) == ["Please call the hotline."]


async def test_invoke_streams_nothing_for_blank_escalation(monkeypatch):
    monkeypatch.setattr(
        coordinator_main, "route_request", lambda _q: {"route": "escalate", "response": "   "}
    )

    stream = await coordinator_main.invoke({"prompt": "USER: pus", "stream": True})

    assert await _drain(stream) == []


async def test_invoke_streams_out_of_scope_response(monkeypatch):
    monkeypatch.setattr(
        coordinator_main,
        "route_request",
        lambda _q: {
            "route": "out_of_scope",
            "response": "Sorry, I am only able to assist with queries related to eye or ophthalmology.",
        },
    )

    stream = await coordinator_main.invoke({"prompt": "USER: book flight tickets", "stream": True})

    assert await _drain(stream) == [
        "Sorry, I am only able to assist with queries related to eye or ophthalmology."
    ]


async def test_invoke_streams_message_for_unknown_route(monkeypatch):
    monkeypatch.setattr(coordinator_main, "route_request", lambda _q: {"route": "mystery"})
    monkeypatch.setattr(coordinator_main, "get_specialist_by_name", lambda _n: None)

    stream = await coordinator_main.invoke({"prompt": "USER: hi", "stream": True})

    assert await _drain(stream) == ["I could not find a specialist for route: mystery"]


async def test_invoke_streams_message_for_missing_route(monkeypatch):
    monkeypatch.setattr(coordinator_main, "route_request", lambda _q: {})
    monkeypatch.setattr(coordinator_main, "get_specialist_by_name", lambda _n: None)

    stream = await coordinator_main.invoke({"prompt": "USER: hi", "stream": True})

    assert await _drain(stream) == ["I could not find a specialist for route: unknown"]


async def test_invoke_ignores_falsy_stream_flag(monkeypatch):
    class _FakeWorkflow:
        def invoke(self, _state):
            return {"response": "non-streamed"}

    monkeypatch.setattr(coordinator_main, "workflow", _FakeWorkflow())

    out = await coordinator_main.invoke({"prompt": "hi", "stream": False})

    assert out["response"] == "non-streamed"


# ── module wiring ─────────────────────────────────────────────────────────────
def test_module_exposes_app_and_workflow():
    assert coordinator_main.app is not None
    assert coordinator_main.workflow is not None
