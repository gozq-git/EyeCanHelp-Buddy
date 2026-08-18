"""Coordinator — the microkernel core of the Plug-in pattern.

This module is deliberately minimal and stable. It owns only:
  1. ``escalate``    — an always-on clinical safety gate (never a plug-in).
  2. ``llm_triage``  — routes to a specialist by name, using a prompt built
                       dynamically from the registered plug-ins' descriptions.
  3. graph assembly  — wires one node per registered :class:`Specialist`.

Specialists themselves live in the ``specialists/`` package and are discovered
at import time. Adding/removing a specialist requires NO change to this file.
"""
import json
import logging
import os
from typing import Any, Dict, List

from langgraph.graph import END, StateGraph

import specialists  # noqa: F401 — importing the package runs plug-in discovery
from llm import extract_latest_user_input, invoke_model
from specialists.base import CoordinatorState
from specialists.registry import get_specialists

logger = logging.getLogger(__name__)

# Fallback route when triage is unclear. Prefer "healthcare" (RAG-grounded and
# safest default); otherwise fall back to whatever plug-in registered first.
_DEFAULT_ROUTE = "healthcare"

HIGH_RISK_MEDICAL_KEYWORDS = [
    "pus",
    "discharge from the eye",
    "eye discharge",
    "cloudy cornea",
    "脓",
    "流脓",
    "眼部分泌物",
    "角膜混浊",
    "角膜混濁",
    "nanah",
    "leleran mata",
    "kornea keruh",
    "சீழ்",
    "கண் சீழ்",
    "மங்கலான கார்னியா",
]

ESCALATION_REVIEW_SYSTEM_PROMPT = """You are a clinical risk screening assistant.
Determine whether the user message requires immediate escalation to a medical hotline.

Escalate when there are high-risk eye/medical danger signs, including but not limited to:
- pus/discharge from the eye
- cloudy cornea
- sudden vision loss
- severe eye pain
- chemical injury or trauma
- acute worsening after surgery

Return strict JSON with this schema:
{"escalate": true|false, "reason": "short reason", "detected_terms": ["term1", "term2"]}
No extra text.
"""

_SUPPORTED_LANGUAGES = {"en", "zh", "ms", "ta"}

_ESCALATION_TEXT = {
    "en": {
        "base": "Your symptoms may require urgent attention.",
        "hotline": (
            "During office hours (8:30am to 5:30pm, weekdays):\n"
            "- Please call 81263632\n\n"
            "After office hours (including weekends and public holidays):\n"
            "- Call eye doctor on call via TTSH operator at 6256 6011 OR\n"
            "- Walk in to TTSH Emergency Department (together with this information sheet at)\n\n"
            "Tan Tock Seng Hospital\n"
            "Basement 1\n"
            "11 Jalan Tan Tock Seng\n"
            "Singapore 308433"
        ),
    },
    "zh": {
        "base": "您的症状可能需要紧急处理。",
        "hotline": (
            "办公时间（工作日 8:30am 至 5:30pm）：\n"
            "- 请致电 81263632\n\n"
            "非办公时间（包括周末及公共假期）：\n"
            "- 请通过 TTSH 总机 6256 6011 联系眼科值班医生，或\n"
            "- 请携带此信息单前往 TTSH 急诊部\n\n"
            "陈笃生医院\n"
            "B1 层\n"
            "11 Jalan Tan Tock Seng\n"
            "Singapore 308433"
        ),
    },
    "ms": {
        "base": "Gejala anda mungkin memerlukan perhatian segera.",
        "hotline": (
            "Semasa waktu pejabat (8:30 pagi hingga 5:30 petang, hari bekerja):\n"
            "- Sila hubungi 81263632\n\n"
            "Selepas waktu pejabat (termasuk hujung minggu dan cuti umum):\n"
            "- Hubungi doktor mata bertugas melalui operator TTSH di 6256 6011 ATAU\n"
            "- Datang terus ke Jabatan Kecemasan TTSH (bawa helaian maklumat ini bersama)\n\n"
            "Tan Tock Seng Hospital\n"
            "Aras Basement 1\n"
            "11 Jalan Tan Tock Seng\n"
            "Singapore 308433"
        ),
    },
    "ta": {
        "base": "உங்கள் அறிகுறிகளுக்கு அவசர கவனம் தேவைப்படலாம்.",
        "hotline": (
            "அலுவலக நேரத்தில் (கிழமைகள், காலை 8:30 முதல் மாலை 5:30 வரை):\n"
            "- தயவுசெய்து 81263632 என்ற எண்ணிற்கு அழைக்கவும்\n\n"
            "அலுவலக நேரத்திற்குப் பிறகு (வார இறுதி மற்றும் பொது விடுமுறைகள் உட்பட):\n"
            "- TTSH ஆபரேட்டர் 6256 6011 மூலம் கண் மருத்துவர் (on-call) ஐ தொடர்புகொள்ளவும் அல்லது\n"
            "- இந்த தகவல் தாளை எடுத்துக்கொண்டு TTSH அவசர சிகிச்சைப் பிரிவிற்கு நேரடியாக செல்லவும்\n\n"
            "Tan Tock Seng Hospital\n"
            "Basement 1\n"
            "11 Jalan Tan Tock Seng\n"
            "Singapore 308433"
        ),
    },
}


def _build_triage_prompt(specs) -> str:
    """Construct the triage system prompt from the registered plug-ins."""
    catalogue = "\n".join(f"- {s.name}: {s.description}" for s in specs)
    labels = " OR ".join(s.name for s in specs)
    return (
        "You are a routing assistant.\n"
        "Classify the user message into exactly one label:\n"
        f"{catalogue}\n\n"
        f"Return exactly one word: {labels}.\n"
        "No punctuation and no extra text.\n"
    )


def _contains_high_risk_keywords(text: str) -> List[str]:
    normalized = (text or "").lower()
    return [keyword for keyword in HIGH_RISK_MEDICAL_KEYWORDS if keyword in normalized]


def _parse_escalation_decision(raw: str) -> Dict[str, Any]:
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            escalate = bool(data.get("escalate", False))
            reason = str(data.get("reason", "")).strip()
            terms = data.get("detected_terms", [])
            if not isinstance(terms, list):
                terms = []
            detected_terms = [str(item).strip() for item in terms if str(item).strip()]
            return {"escalate": escalate, "reason": reason, "detected_terms": detected_terms}
    except Exception:
        pass
    return {"escalate": False, "reason": "", "detected_terms": []}


def _extract_language_from_prompt(prompt: str) -> str:
    for line in (prompt or "").splitlines():
        clean = line.strip()
        if clean.upper().startswith("LANGUAGE:"):
            value = clean.split(":", 1)[1].strip().lower()
            if value in _SUPPORTED_LANGUAGES:
                return value
            return "en"
    return "en"


def _build_escalation_response(*, language: str) -> str:
    copy = _ESCALATION_TEXT.get(language, _ESCALATION_TEXT["en"])
    return f"{copy['base']}\n\n{copy['hotline']}"


def _escalate_node(state: CoordinatorState) -> CoordinatorState:
    prompt = state.get("prompt", "")
    language = _extract_language_from_prompt(prompt)
    user_query = extract_latest_user_input(prompt)
    query = user_query or prompt

    keyword_hits = _contains_high_risk_keywords(query)
    model_raw = invoke_model(ESCALATION_REVIEW_SYSTEM_PROMPT, query)
    model_decision = _parse_escalation_decision(model_raw)

    should_escalate = bool(keyword_hits) or bool(model_decision.get("escalate", False))
    if should_escalate:
        return {
            "route": "escalate",
            "kb_query": query,
            "response": _build_escalation_response(language=language),
        }

    logger.info("Escalation check passed. Proceeding to triage.")
    return {"route": "triage", "kb_query": query}


def _make_triage_node(specs):
    triage_prompt = _build_triage_prompt(specs)
    valid = {s.name for s in specs}
    if _DEFAULT_ROUTE in valid:
        default = _DEFAULT_ROUTE
    elif specs:
        default = specs[0].name
    else:
        default = _DEFAULT_ROUTE

    def _llm_triage_node(state: CoordinatorState) -> CoordinatorState:
        prompt = state.get("prompt", "")
        user_query = state.get("kb_query", "") or extract_latest_user_input(prompt)
        decision = invoke_model(triage_prompt, user_query or prompt).strip().lower()

        route = next((name for name in valid if name in decision), default)
        logger.info("Coordinator triage selected route=%s", route)
        return {"route": route, "kb_query": user_query or prompt}

    return _llm_triage_node


def _escalation_route_edge(state: CoordinatorState) -> str:
    return state.get("route", "triage")


def _triage_route_edge(state: CoordinatorState) -> str:
    return state.get("route", _DEFAULT_ROUTE)


def route_request(prompt: str) -> CoordinatorState:
    """Resolve escalation/triage route without executing specialist nodes."""
    state: CoordinatorState = {"prompt": prompt}

    escalation_update = _escalate_node(state)
    state.update(escalation_update)
    if state.get("route") == "escalate":
        return state

    triage_update = _make_triage_node(get_specialists())(state)
    state.update(triage_update)
    return state


def get_specialist_by_name(name: str):
    for specialist in get_specialists():
        if specialist.name == name:
            return specialist
    return None


def create_agent():
    specs = get_specialists()
    if not specs:
        raise RuntimeError("No specialist plug-ins registered — check the specialists/ package.")

    graph = StateGraph(CoordinatorState)
    graph.add_node("escalate", _escalate_node)
    graph.add_node("llm_triage", _make_triage_node(specs))

    # One node per plug-in — the core does not name them explicitly.
    for spec in specs:
        graph.add_node(spec.name, spec.handle)
        graph.add_edge(spec.name, END)

    graph.set_entry_point("escalate")
    graph.add_conditional_edges(
        "escalate",
        _escalation_route_edge,
        {"triage": "llm_triage", "escalate": END},
    )
    graph.add_conditional_edges(
        "llm_triage",
        _triage_route_edge,
        {spec.name: spec.name for spec in specs},
    )

    return graph.compile()
