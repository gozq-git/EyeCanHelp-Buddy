"""Financial specialist plug-in - RAG over the financial knowledge base."""
import logging
import os

from llm import invoke_model, invoke_model_stream
from specialists.base import CoordinatorState, Specialist
from specialists.registry import register
from tools.kb_tools import format_financial_kb_response, search_financial_kb

logger = logging.getLogger(__name__)

FINANCIAL_SYSTEM_PROMPT = """You are a Financial Specialist Agent.
You answer user financial questions using only retrieved information from the financial knowledge base.

Focus areas:
- Budgeting and expense planning
- Debt payoff strategies
- Emergency fund and savings planning
- Investment basics and portfolio allocation education
- Insurance and tax planning considerations

Always:
- Base your answer on the provided KB snippets.
- Be concise, practical, and explicit about assumptions.
- If snippets are insufficient, say what is missing and direct the user to billing/financial offices.
- Do not invent facts that are not present in the snippets.
- End with a short action checklist.
"""

_NO_INFO = "No information available."

_QUERY_REWRITE_SYSTEM_PROMPT = """You rewrite follow-up financial user messages into a standalone
financial search query for retrieval.

Rules:
- Return exactly one line.
- Keep key financial entities and constraints from the user input.
- Do not add facts not present in the user input.
- If the user input is already standalone, return it unchanged.
"""

_AMBIGUOUS_HINTS = (
    "this",
    "that",
    "it",
    "normal",
    "what about",
    "how about",
    "same",
    "that one",
)


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _rewrite_word_threshold() -> int:
    raw = os.getenv("FINANCIAL_QUERY_REWRITE_MAX_WORDS", "8")
    try:
        threshold = int(raw)
    except ValueError:
        return 8
    return min(max(threshold, 3), 20)


def _should_rewrite_query(query: str) -> bool:
    cleaned = (query or "").strip().lower()
    if not cleaned:
        return False

    words = cleaned.split()
    is_short = len(words) <= _rewrite_word_threshold()
    has_ambiguous_hint = any(hint in cleaned for hint in _AMBIGUOUS_HINTS)
    return is_short or has_ambiguous_hint


def _sanitize_rewrite(candidate: str, fallback: str) -> str:
    rewritten = (candidate or "").strip()
    if not rewritten:
        return fallback

    if "\n" in rewritten:
        rewritten = rewritten.splitlines()[0].strip()

    rewritten = rewritten.strip('"').strip("'")
    lowered = rewritten.lower()
    if lowered in {"no rewrite needed", "unchanged", "n/a"}:
        return fallback

    words = rewritten.split()
    if len(words) < 3:
        return fallback

    if len(words) > 40:
        rewritten = " ".join(words[:40])

    return rewritten


def _extract_chat_turns(prompt: str) -> list[str]:
    return [line.strip() for line in (prompt or "").splitlines() if line.strip()]


def _resolve_previous_chat_context(query: str, prompt: str) -> list[str]:
    turns = _extract_chat_turns(prompt)
    if not turns:
        return []

    latest = (query or "").strip()
    for idx in range(len(turns) - 1, -1, -1):
        line = turns[idx]
        if line.upper().startswith("USER:") and line[5:].strip() == latest:
            return turns[:idx] + turns[idx + 1 :]

    return turns


def _rewrite_for_retrieval(query: str, previous_chat_context: list[str] | None = None) -> str:
    context_block = ""
    turns = previous_chat_context or []
    if turns:
        history = "\n".join(turns)
        context_block = f"Previous chat context:\n{history}\n\n"

    model_output = invoke_model(
        _QUERY_REWRITE_SYSTEM_PROMPT,
        f"{context_block}User message:\n{query}\n\nStandalone retrieval query:",
    )
    return _sanitize_rewrite(model_output, query)


def _resolve_retrieval_query(query: str, prompt: str = "") -> str:
    cleaned = (query or "").strip()
    if not cleaned:
        return ""

    rewrite_enabled = _env_bool("FINANCIAL_QUERY_REWRITE_ENABLED", default=True)
    if not rewrite_enabled:
        return cleaned

    if not _should_rewrite_query(cleaned):
        return cleaned

    previous_chat_context = _resolve_previous_chat_context(cleaned, prompt)
    rewritten = _rewrite_for_retrieval(cleaned, previous_chat_context=previous_chat_context)
    if rewritten != cleaned:
        logger.info("Financial KB rewrite applied: '%s' -> '%s'", cleaned, rewritten)
    return rewritten


def _build_financial_prompt(query: str, prompt: str = ""):
    original_query = (query or "").strip()
    retrieval_query = _resolve_retrieval_query(original_query, prompt=prompt)

    results = search_financial_kb(retrieval_query)
    if not results:
        return None, []

    if any("error" in item for item in results if isinstance(item, dict)):
        return None, results

    kb_context = format_financial_kb_response(retrieval_query, results)
    if not kb_context or "could not find relevant information" in kb_context.lower():
        return None, results

    retrieval_note = ""
    if retrieval_query and retrieval_query != original_query:
        retrieval_note = f"Query used for retrieval:\n{retrieval_query}\n\n"

    financial_prompt = (
        f"User query:\n{original_query}\n\n"
        f"{retrieval_note}"
        "Retrieved financial knowledge base evidence:\n"
        f"{kb_context}\n\n"
        "Provide the best possible answer grounded only in the retrieved evidence."
    )
    return financial_prompt, results


@register
class FinancialSpecialist(Specialist):
    name = "financial"
    description = "payment, medical cost, medisave, billing and budgeting questions."

    def handle(self, state: CoordinatorState) -> CoordinatorState:
        query = state.get("kb_query", state.get("prompt", ""))
        prompt = state.get("prompt", "")
        financial_prompt, results = _build_financial_prompt(query, prompt=prompt)
        if not financial_prompt:
            return {"kb_results": results, "response": _NO_INFO}

        answer = invoke_model(FINANCIAL_SYSTEM_PROMPT, financial_prompt)
        if not answer.strip():
            return {"kb_results": results, "response": _NO_INFO}

        return {"kb_results": results, "response": answer}

    def handle_stream(self, state: CoordinatorState):
        query = state.get("kb_query", state.get("prompt", ""))
        prompt = state.get("prompt", "")
        financial_prompt, _results = _build_financial_prompt(query, prompt=prompt)
        if not financial_prompt:
            yield _NO_INFO
            return

        yielded = False
        for token in invoke_model_stream(FINANCIAL_SYSTEM_PROMPT, financial_prompt):
            if token:
                yielded = True
                yield token

        if not yielded:
            yield _NO_INFO
