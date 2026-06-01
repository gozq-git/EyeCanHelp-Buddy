import json
import os
import logging
from typing import Any, Dict, List, Literal, TypedDict

import boto3
from langgraph.graph import END, StateGraph

from tools.kb_tools import format_kb_response, search_medical_kb

logger = logging.getLogger(__name__)


class CoordinatorState(TypedDict, total=False):
    prompt: str
    route: Literal["triage", "financial", "healthcare", "escalate"]
    response: str
    kb_query: str
    kb_results: List[Dict[str, Any]]


FINANCIAL_SYSTEM_PROMPT = """You are a Financial Specialist Agent.
Provide practical, conservative, and well-structured financial guidance.

Focus areas:
- Budgeting and expense planning
- Debt payoff strategies
- Emergency fund and savings planning
- Investment basics and portfolio allocation education
- Insurance and tax planning considerations

Always:
- State assumptions when data is missing.
- Highlight risks and tradeoffs.
- Avoid guaranteeing returns.
- End with a short action checklist.
"""

HEALTHCARE_SYSTEM_PROMPT = """You are a Healthcare Specialist Agent.
You answer user healthcare questions using only retrieved information from the medical knowledge base.

Always:
- Base your answer on the provided KB snippets.
- Be concise, factual, and safe.
- If snippets are insufficient, say what is missing and advise seeing a licensed clinician.
- Do not invent facts that are not present in the snippets.
- Do not mention directly what was retrieved by the KB snippets.
- End with a short safety note for urgent symptoms.
"""

HIGH_RISK_MEDICAL_KEYWORDS = [
    "pus",
    "cloudy cornea",
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

TRIAGE_SYSTEM_PROMPT = """You are a routing assistant.
Classify the user message into exactly one label:
- financial: payment, medical cost, medisave.
- healthcare: symptoms, medical conditions, treatment, medication, clinical questions.

Return exactly one word: financial OR healthcare.
No punctuation and no extra text.
"""

def _extract_latest_user_input(prompt: str) -> str:
    lines = [line.strip() for line in (prompt or "").splitlines() if line.strip()]
    for line in reversed(lines):
        if line.upper().startswith("USER:"):
            return line[5:].strip()
    return (prompt or "").strip()


def _invoke_model(system_prompt: str, user_prompt: str) -> str:
    model_name = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-5-20250929-v1:0")
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
    temperature = float(os.getenv("BEDROCK_TEMPERATURE", "0.2"))

    try:
        client = boto3.client("bedrock-runtime", region_name=region)
        response = client.converse(
            modelId=model_name,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": user_prompt}]}],
            inferenceConfig={"temperature": temperature},
        )

        output = response.get("output", {}).get("message", {}).get("content", [])
        text_parts = [str(item.get("text", "")).strip() for item in output if isinstance(item, dict)]
        text = "\n".join(part for part in text_parts if part)
        return text or "No response returned from Bedrock model."
    except Exception as exc:
        return f"I could not generate a model response from Bedrock: {str(exc)}"


def _escalation_route_edge(state: CoordinatorState) -> str:
    return state.get("route", "triage")


def _triage_route_edge(state: CoordinatorState) -> str:
    return state.get("route", "healthcare")


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


def _escalate_node(state: CoordinatorState) -> CoordinatorState:
    prompt = state.get("prompt", "")
    user_query = _extract_latest_user_input(prompt)
    query = user_query or prompt

    keyword_hits = _contains_high_risk_keywords(query)
    model_raw = _invoke_model(ESCALATION_REVIEW_SYSTEM_PROMPT, query)
    model_decision = _parse_escalation_decision(model_raw)

    should_escalate = bool(keyword_hits) or bool(model_decision.get("escalate", False))
    if should_escalate:
        hotline = os.getenv("MEDICAL_HOTLINE_CONTACT", "your medical hotline")
        detected = keyword_hits + [
            term for term in model_decision.get("detected_terms", []) if term not in keyword_hits
        ]
        details = f" Detected: {', '.join(detected)}." if detected else ""
        reason = str(model_decision.get("reason", "")).strip()
        reason_text = f" Reason: {reason}." if reason else ""
        return {
            "route": "escalate",
            "kb_query": query,
            "response": (
                f"Your symptoms may require urgent attention.{details}{reason_text} "
                f"Please contact {hotline} immediately for medical advice."
            ),
        }

    logger.info("Escalation check passed. Proceeding to triage.")
    return {"route": "triage", "kb_query": query}


def _llm_triage_node(state: CoordinatorState) -> CoordinatorState:
    prompt = state.get("prompt", "")
    user_query = state.get("kb_query", "") or _extract_latest_user_input(prompt)
    decision = _invoke_model(TRIAGE_SYSTEM_PROMPT, user_query or prompt).strip().lower()

    route: Literal["financial", "healthcare"]
    if "financial" in decision:
        route = "financial"
    else:
        route = "healthcare"

    logger.info("Coordinator triage selected route=%s", route)

    return {"route": route, "kb_query": user_query or prompt}


def _financial_node(state: CoordinatorState) -> CoordinatorState:
    query = state.get("kb_query", state.get("prompt", ""))
    return {"response": _invoke_model(FINANCIAL_SYSTEM_PROMPT, query)}


def _healthcare_node(state: CoordinatorState) -> CoordinatorState:
    query = state.get("kb_query", state.get("prompt", ""))
    results = search_medical_kb(query)
    if not results:
        return {"kb_results": [], "response": "No information available."}

    if any("error" in item for item in results if isinstance(item, dict)):
        return {"kb_results": results, "response": "No information available."}

    kb_context = format_kb_response(query, results)
    if not kb_context or "could not find relevant information" in kb_context.lower():
        return {"kb_results": results, "response": "No information available."}

    healthcare_prompt = (
        f"User query:\n{query}\n\n"
        "Retrieved medical knowledge base evidence:\n"
        f"{kb_context}\n\n"
        "Provide the best possible answer grounded only in the retrieved evidence."
    )
    answer = _invoke_model(HEALTHCARE_SYSTEM_PROMPT, healthcare_prompt)
    if not answer.strip():
        return {"kb_results": results, "response": "No information available."}

    return {"kb_results": results, "response": answer}


def _contains_high_risk_keywords(text: str) -> List[str]:
    normalized = (text or "").lower()
    return [keyword for keyword in HIGH_RISK_MEDICAL_KEYWORDS if keyword in normalized]


def create_agent():
    graph = StateGraph(CoordinatorState)
    graph.add_node("escalate", _escalate_node)
    graph.add_node("llm_triage", _llm_triage_node)
    graph.add_node("financial", _financial_node)
    graph.add_node("healthcare", _healthcare_node)

    graph.set_entry_point("escalate")
    graph.add_conditional_edges(
        "escalate",
        _escalation_route_edge,
        {
            "triage": "llm_triage",
            "escalate": END,
        },
    )
    graph.add_conditional_edges(
        "llm_triage",
        _triage_route_edge,
        {
            "financial": "financial",
            "healthcare": "healthcare",
        },
    )
    graph.add_edge("financial", END)
    graph.add_edge("healthcare", END)

    return graph.compile()
