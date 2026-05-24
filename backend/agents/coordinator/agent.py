import os
import logging
from typing import Any, Dict, List, Literal, TypedDict

import boto3
from langgraph.graph import END, StateGraph

from tools.kb_tools import format_kb_response, search_medical_kb

logger = logging.getLogger(__name__)


class CoordinatorState(TypedDict, total=False):
    prompt: str
    route: Literal["financial", "healthcare", "generic"]
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

GENERIC_SYSTEM_PROMPT = """You are a helpful assistant.
Answer general questions clearly and concisely.

If a question is clearly financial-planning specific or healthcare-medical specific,
do not answer in detail and instead provide a short placeholder indicating handoff.
"""

TRIAGE_SYSTEM_PROMPT = """You are a routing assistant.
Classify the user message into exactly one label:
- financial: payment, medical cost, medisave.
- healthcare: symptoms, medical conditions, treatment, medication, clinical questions.
- generic: everything else.

Return exactly one word: financial OR healthcare OR generic.
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


def _llm_triage_node(state: CoordinatorState) -> CoordinatorState:
    prompt = state.get("prompt", "")
    user_query = _extract_latest_user_input(prompt)
    decision = _invoke_model(TRIAGE_SYSTEM_PROMPT, user_query or prompt).strip().lower()

    route: Literal["financial", "healthcare", "generic"]
    if "financial" in decision:
        route = "financial"
    elif "healthcare" in decision:
        route = "healthcare"
    elif "generic" in decision:
        route = "generic"
    else:
        route = "generic"

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

    text = format_kb_response(query, results)
    if not text or "could not find relevant information" in text.lower():
        return {"kb_results": results, "response": "No information available."}

    return {"kb_results": results, "response": text}


def _generic_node(state: CoordinatorState) -> CoordinatorState:
    query = state.get("kb_query", state.get("prompt", ""))
    return {"response": _invoke_model(GENERIC_SYSTEM_PROMPT, query)}


def _route_edge(state: CoordinatorState) -> str:
    return state.get("route", "generic")


def create_agent():
    graph = StateGraph(CoordinatorState)
    graph.add_node("llm_triage", _llm_triage_node)
    graph.add_node("financial", _financial_node)
    graph.add_node("healthcare", _healthcare_node)
    graph.add_node("generic", _generic_node)

    graph.set_entry_point("llm_triage")
    graph.add_conditional_edges(
        "llm_triage",
        _route_edge,
        {
            "financial": "financial",
            "healthcare": "healthcare",
            "generic": "generic",
        },
    )
    graph.add_edge("financial", END)
    graph.add_edge("healthcare", END)
    graph.add_edge("generic", END)

    return graph.compile()
