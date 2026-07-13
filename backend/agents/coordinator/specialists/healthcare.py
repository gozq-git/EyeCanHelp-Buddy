"""Healthcare specialist plug-in — RAG over the TTSH medical knowledge base."""
import logging
import os

from llm import invoke_model, invoke_model_stream
from specialists.base import CoordinatorState, Specialist
from specialists.registry import register
from tools.kb_tools import format_kb_response, search_medical_kb

logger = logging.getLogger(__name__)

HEALTHCARE_SYSTEM_PROMPT = """You are a Healthcare Specialist Agent.
You answer user healthcare questions using only retrieved information from the medical knowledge base.

Always:
- Base your answer on the provided KB snippets.
- Be concise, factual, and safe.
- If snippets are insufficient, say what is missing and advise seeing a licensed clinician.
- Do not invent facts that are not present in the snippets.
- If the snippets are relevant, always phrase the answer using the same phrasing as the snippets.
- If the snippets are not relevant, do not mention directly what was retrieved by the KB snippets.
- End with a short safety note for urgent symptoms.
"""

_NO_INFO = "No information available."

_QUERY_REWRITE_SYSTEM_PROMPT = """You rewrite follow-up healthcare user messages into a standalone
medical search query for retrieval.

Rules:
- Return exactly one line.
- Keep key medical entities and symptoms from the user input.
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
    "side effect",
    "side effects",
)


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _rewrite_word_threshold() -> int:
    raw = os.getenv("HEALTHCARE_QUERY_REWRITE_MAX_WORDS", "8")
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


def _rewrite_for_retrieval(query: str) -> str:
    model_output = invoke_model(
        _QUERY_REWRITE_SYSTEM_PROMPT,
        f"User message:\n{query}\n\nStandalone retrieval query:",
    )
    return _sanitize_rewrite(model_output, query)


def _resolve_retrieval_query(query: str) -> str:
    cleaned = (query or "").strip()
    if not cleaned:
        return ""

    rewrite_enabled = _env_bool("HEALTHCARE_QUERY_REWRITE_ENABLED", default=True)
    if not rewrite_enabled:
        return cleaned

    if not _should_rewrite_query(cleaned):
        return cleaned

    rewritten = _rewrite_for_retrieval(cleaned)
    if rewritten != cleaned:
        logger.info("Healthcare KB rewrite applied: '%s' -> '%s'", cleaned, rewritten)
    return rewritten


def _build_healthcare_prompt(query: str):
    original_query = (query or "").strip()
    retrieval_query = _resolve_retrieval_query(original_query)

    results = search_medical_kb(retrieval_query)
    if not results:
        return None, []

    if any("error" in item for item in results if isinstance(item, dict)):
        return None, results

    kb_context = format_kb_response(retrieval_query, results)
    if not kb_context or "could not find relevant information" in kb_context.lower():
        return None, results

    retrieval_note = ""
    if retrieval_query and retrieval_query != original_query:
        retrieval_note = f"Query used for retrieval:\n{retrieval_query}\n\n"

    healthcare_prompt = (
        f"User query:\n{original_query}\n\n"
        f"{retrieval_note}"
        "Retrieved medical knowledge base evidence:\n"
        f"{kb_context}\n\n"
        "Provide the best possible answer grounded only in the retrieved evidence."
    )
    return healthcare_prompt, results


@register
class HealthcareSpecialist(Specialist):
    name = "healthcare"
    description = "symptoms, medical conditions, treatment, medication, clinical questions."

    def handle(self, state: CoordinatorState) -> CoordinatorState:
        query = state.get("kb_query", state.get("prompt", ""))
        healthcare_prompt, results = _build_healthcare_prompt(query)
        if not healthcare_prompt:
            return {"kb_results": results, "response": _NO_INFO}

        answer = invoke_model(HEALTHCARE_SYSTEM_PROMPT, healthcare_prompt)
        if not answer.strip():
            return {"kb_results": results, "response": _NO_INFO}

        return {"kb_results": results, "response": answer}

    def handle_stream(self, state: CoordinatorState):
        query = state.get("kb_query", state.get("prompt", ""))
        healthcare_prompt, _results = _build_healthcare_prompt(query)
        if not healthcare_prompt:
            yield _NO_INFO
            return

        yielded = False
        for token in invoke_model_stream(HEALTHCARE_SYSTEM_PROMPT, healthcare_prompt):
            if token:
                yielded = True
                yield token

        if not yielded:
            yield _NO_INFO
