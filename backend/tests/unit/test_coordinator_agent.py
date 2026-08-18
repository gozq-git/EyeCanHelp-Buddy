"""Unit tests for the coordinator microkernel (agents/coordinator/agent.py).

The model is always mocked: `agent.invoke_model` is monkeypatched, so escalation
and triage decisions are driven by canned strings rather than Bedrock.
"""
import sys
from pathlib import Path

import pytest

COORDINATOR_DIR = Path(__file__).resolve().parents[2] / "agents" / "coordinator"
if str(COORDINATOR_DIR) not in sys.path:
    # Append so backend/main.py keeps precedence for `import main`.
    sys.path.append(str(COORDINATOR_DIR))

import agent as coordinator_agent
from specialists.base import Specialist

pytestmark = pytest.mark.unit

_NO_ESCALATION = '{"escalate": false, "reason": "", "detected_terms": []}'


class _StubSpecialist(Specialist):
    def __init__(self, name, description="stub specialist"):
        self.name = name
        self.description = description

    def handle(self, state):
        return {"response": f"{self.name} answered"}


@pytest.fixture
def no_escalation(monkeypatch):
    """Model says "do not escalate" for every call."""
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _sys, _user: _NO_ESCALATION)


# ── _build_triage_prompt ──────────────────────────────────────────────────────
def test_build_triage_prompt_lists_every_plugin():
    specs = [_StubSpecialist("healthcare", "clinical questions"), _StubSpecialist("financial", "billing")]

    prompt = coordinator_agent._build_triage_prompt(specs)

    assert "- healthcare: clinical questions" in prompt
    assert "- financial: billing" in prompt
    assert "return exactly one word: out_of_scope." in prompt
    assert "Return exactly one word: healthcare OR financial OR out_of_scope." in prompt


# ── _contains_high_risk_keywords ──────────────────────────────────────────────
def test_contains_high_risk_keywords_matches_case_insensitively():
    assert coordinator_agent._contains_high_risk_keywords("There is PUS in my eye") == ["pus"]


def test_contains_high_risk_keywords_returns_empty_for_benign_text():
    assert coordinator_agent._contains_high_risk_keywords("mild itchiness") == []


def test_contains_high_risk_keywords_handles_none():
    assert coordinator_agent._contains_high_risk_keywords(None) == []


# ── _parse_escalation_decision ────────────────────────────────────────────────
def test_parse_escalation_decision_reads_valid_json():
    raw = '{"escalate": true, "reason": "sudden vision loss", "detected_terms": ["vision loss", " "]}'

    out = coordinator_agent._parse_escalation_decision(raw)

    assert out == {"escalate": True, "reason": "sudden vision loss", "detected_terms": ["vision loss"]}


def test_parse_escalation_decision_coerces_non_list_terms():
    out = coordinator_agent._parse_escalation_decision('{"escalate": false, "detected_terms": "nope"}')

    assert out["detected_terms"] == []


@pytest.mark.parametrize("raw", ["not json", "", "[1, 2, 3]", '"a string"', None])
def test_parse_escalation_decision_defaults_on_unusable_output(raw):
    assert coordinator_agent._parse_escalation_decision(raw) == {
        "escalate": False,
        "reason": "",
        "detected_terms": [],
    }


# ── _escalate_node ────────────────────────────────────────────────────────────
def test_escalate_node_escalates_on_keyword_hit(monkeypatch):
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: _NO_ESCALATION)

    out = coordinator_agent._escalate_node({"prompt": "USER: I see pus in my eye"})

    assert out["route"] == "escalate"
    assert out["kb_query"] == "I see pus in my eye"
    assert "Detected:" not in out["response"]
    assert "Reason:" not in out["response"]
    assert "Please call 81263632" in out["response"]
    assert "TTSH operator at 6256 6011" in out["response"]


def test_escalate_node_escalates_on_model_decision(monkeypatch):
    decision = '{"escalate": true, "reason": "acute worsening", "detected_terms": ["sudden vision loss"]}'
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: decision)

    out = coordinator_agent._escalate_node({"prompt": "USER: everything went dark"})

    assert out["route"] == "escalate"
    assert "Detected:" not in out["response"]
    assert "Reason:" not in out["response"]


def test_escalate_node_does_not_duplicate_detected_terms(monkeypatch):
    decision = '{"escalate": true, "reason": "", "detected_terms": ["pus"]}'
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: decision)

    out = coordinator_agent._escalate_node({"prompt": "USER: pus discharge"})

    assert "Detected:" not in out["response"]
    assert "Reason:" not in out["response"]


def test_escalate_node_uses_default_hotline(monkeypatch):
    monkeypatch.delenv("MEDICAL_HOTLINE_CONTACT", raising=False)
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: _NO_ESCALATION)

    out = coordinator_agent._escalate_node({"prompt": "USER: cloudy cornea today"})

    assert "Please call 81263632" in out["response"]
    assert "TTSH operator at 6256 6011" in out["response"]


def test_escalate_node_passes_through_to_triage(no_escalation):
    out = coordinator_agent._escalate_node({"prompt": "USER: what is a cataract?"})

    assert out == {"route": "triage", "kb_query": "what is a cataract?"}


def test_escalate_node_falls_back_to_raw_prompt(no_escalation):
    out = coordinator_agent._escalate_node({"prompt": "no user marker here"})

    assert out["kb_query"] == "no user marker here"


# ── _make_triage_node ─────────────────────────────────────────────────────────
def test_triage_node_selects_the_named_route(monkeypatch):
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: "  Financial  ")
    node = coordinator_agent._make_triage_node(
        [_StubSpecialist("healthcare"), _StubSpecialist("financial")]
    )

    out = node({"prompt": "USER: how much does it cost", "kb_query": "how much does it cost"})

    assert out == {"route": "financial", "kb_query": "how much does it cost"}


def test_triage_node_defaults_to_healthcare_when_unclear(monkeypatch):
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: "no idea")
    node = coordinator_agent._make_triage_node(
        [_StubSpecialist("healthcare"), _StubSpecialist("financial")]
    )

    assert node({"prompt": "USER: hmm"})["route"] == "healthcare"


def test_triage_node_defaults_to_first_plugin_without_healthcare(monkeypatch):
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: "unmatched")
    node = coordinator_agent._make_triage_node([_StubSpecialist("financial"), _StubSpecialist("legal")])

    assert node({"prompt": "USER: hmm"})["route"] == "financial"


def test_triage_node_defaults_to_healthcare_with_no_plugins(monkeypatch):
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: "unmatched")
    node = coordinator_agent._make_triage_node([])

    assert node({"prompt": "USER: hmm"})["route"] == "healthcare"


def test_triage_node_extracts_query_from_transcript(monkeypatch):
    seen = {}

    def _fake_invoke(_system, user_prompt):
        seen["user_prompt"] = user_prompt
        return "healthcare"

    monkeypatch.setattr(coordinator_agent, "invoke_model", _fake_invoke)
    node = coordinator_agent._make_triage_node([_StubSpecialist("healthcare")])

    node({"prompt": "SYSTEM: hi\nUSER: my eye hurts"})

    assert seen["user_prompt"] == "my eye hurts"


def test_triage_node_returns_out_of_scope_response(monkeypatch):
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: "OUT_OF_SCOPE")
    node = coordinator_agent._make_triage_node(
        [_StubSpecialist("healthcare"), _StubSpecialist("financial")]
    )

    out = node({"prompt": "USER: how do I renew my passport?", "kb_query": "how do I renew my passport?"})

    assert out == {
        "route": "out_of_scope",
        "kb_query": "how do I renew my passport?",
        "response": "Sorry, I am only able to assist with queries related to eye or ophthalmology.",
    }


# ── route edges ───────────────────────────────────────────────────────────────
def test_escalation_route_edge_reads_state():
    assert coordinator_agent._escalation_route_edge({"route": "escalate"}) == "escalate"
    assert coordinator_agent._escalation_route_edge({}) == "triage"


def test_triage_route_edge_reads_state():
    assert coordinator_agent._triage_route_edge({"route": "financial"}) == "financial"
    assert coordinator_agent._triage_route_edge({}) == "healthcare"


# ── route_request ─────────────────────────────────────────────────────────────
def test_route_request_short_circuits_on_escalation(monkeypatch):
    monkeypatch.setattr(coordinator_agent, "invoke_model", lambda _s, _u: _NO_ESCALATION)

    state = coordinator_agent.route_request("USER: pus is leaking")

    assert state["route"] == "escalate"
    assert "urgent attention" in state["response"]


def test_route_request_continues_to_triage(monkeypatch):
    calls = []

    def _fake_invoke(_system, user_prompt):
        calls.append(user_prompt)
        # First call is the escalation screen, second is triage.
        return _NO_ESCALATION if len(calls) == 1 else "financial"

    monkeypatch.setattr(coordinator_agent, "invoke_model", _fake_invoke)

    state = coordinator_agent.route_request("USER: how much is the injection")

    assert state["route"] == "financial"
    assert state["kb_query"] == "how much is the injection"
    assert len(calls) == 2


def test_route_request_returns_out_of_scope_response(monkeypatch):
    calls = []

    def _fake_invoke(_system, user_prompt):
        calls.append(user_prompt)
        return _NO_ESCALATION if len(calls) == 1 else "out_of_scope"

    monkeypatch.setattr(coordinator_agent, "invoke_model", _fake_invoke)

    state = coordinator_agent.route_request("USER: what is the weather today")

    assert state["route"] == "out_of_scope"
    assert state["kb_query"] == "what is the weather today"
    assert state["response"] == (
        "Sorry, I am only able to assist with queries related to eye or ophthalmology."
    )


# ── get_specialist_by_name ────────────────────────────────────────────────────
def test_get_specialist_by_name_finds_registered_plugin():
    specialist = coordinator_agent.get_specialist_by_name("healthcare")

    assert specialist is not None
    assert specialist.name == "healthcare"


def test_get_specialist_by_name_returns_none_when_absent():
    assert coordinator_agent.get_specialist_by_name("does-not-exist") is None


# ── create_agent ──────────────────────────────────────────────────────────────
def test_create_agent_compiles_a_graph_with_one_node_per_plugin():
    compiled = coordinator_agent.create_agent()

    nodes = set(compiled.get_graph().nodes)
    assert {"escalate", "llm_triage", "healthcare", "financial"} <= nodes


def test_create_agent_rejects_an_empty_registry(monkeypatch):
    monkeypatch.setattr(coordinator_agent, "get_specialists", lambda: [])

    with pytest.raises(RuntimeError, match="No specialist plug-ins registered"):
        coordinator_agent.create_agent()
