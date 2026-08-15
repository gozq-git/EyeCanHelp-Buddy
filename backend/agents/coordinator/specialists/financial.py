"""Financial specialist plug-in - RAG over the financial knowledge base."""
import logging

from llm import invoke_model, invoke_model_stream
from specialists import rag
from specialists.registry import register
from tools.kb_tools import format_financial_kb_response, search_financial_kb

logger = logging.getLogger(__name__)

FINANCIAL_SYSTEM_PROMPT = """You are a Financial Specialist Agent.
You answer user financial questions using only retrieved information from the financial knowledge base.

Focus areas:
- Price and cost of medical treatment, procedures and medication.

Always:
- Base your answer on the provided KB snippets.
- Be concise, practical, and explicit about assumptions.
- If snippets are insufficient, say what is missing and direct the user to billing/financial offices.
- Do not invent facts that are not present in the snippets.
"""

_NO_INFO = rag.NO_INFO

_QUERY_REWRITE_SYSTEM_PROMPT = """You rewrite follow-up financial user messages into a standalone
financial search query for retrieval.

Rules:
- Return exactly one line.
- Keep key financial entities and constraints from the user input.
- Do not add facts not present in the user input.
- If the user input is already standalone, return it unchanged.
"""

_PROFILE = rag.RagProfile(
    env_prefix="FINANCIAL",
    rewrite_system_prompt=_QUERY_REWRITE_SYSTEM_PROMPT,
    evidence_label="financial knowledge base",
    log_label="Financial",
    ambiguous_hints=(
        "this",
        "that",
        "it",
        "normal",
        "what about",
        "how about",
        "same",
        "that one",
    ),
)

_AMBIGUOUS_HINTS = _PROFILE.ambiguous_hints

# Re-exported for tests and callers; no per-specialist behaviour of their own.
_sanitize_rewrite = rag.sanitize_rewrite
_extract_chat_turns = rag.extract_chat_turns
_resolve_previous_chat_context = rag.resolve_previous_chat_context


def _rewrite_for_retrieval(query: str, previous_chat_context: list[str] | None = None) -> str:
    return rag.rewrite_for_retrieval(query, previous_chat_context, _PROFILE, invoke_model)


def _resolve_retrieval_query(query: str, prompt: str = "") -> str:
    return rag.resolve_retrieval_query(query, prompt, _PROFILE, _rewrite_for_retrieval, logger)


def _build_financial_prompt(query: str, prompt: str = ""):
    return rag.build_grounded_prompt(
        query,
        prompt,
        _PROFILE,
        _resolve_retrieval_query,
        search_financial_kb,
        format_financial_kb_response,
    )


@register
class FinancialSpecialist(rag.RagSpecialist):
    name = "financial"
    description = "payment, medical cost, medisave, billing and budgeting questions."
    system_prompt = FINANCIAL_SYSTEM_PROMPT

    def build_prompt(self, query: str, prompt: str):
        return _build_financial_prompt(query, prompt=prompt)

    def invoke(self, system_prompt: str, user_prompt: str) -> str:
        return invoke_model(system_prompt, user_prompt)

    def invoke_stream(self, system_prompt: str, user_prompt: str):
        return invoke_model_stream(system_prompt, user_prompt)
