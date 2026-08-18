"""Healthcare specialist plug-in — RAG over the TTSH medical knowledge base."""
import logging

from llm import invoke_model, invoke_model_stream
from specialists import rag
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

If there are no relevant retrieved information, reply with "Sorry, I am unable to answer your query. Please contact the medical hotline."
"""

_NO_INFO = rag.NO_INFO

_QUERY_REWRITE_SYSTEM_PROMPT = """You rewrite follow-up healthcare user messages into a standalone
medical search query for retrieval.

Rules:
- Always rewrite in English.
- Return exactly one line.
- Keep key medical entities and symptoms from the user input.
- Do not add facts not present in the user input.
- If the user input is already standalone, return it unchanged.
"""

_PROFILE = rag.RagProfile(
    env_prefix="HEALTHCARE",
    rewrite_system_prompt=_QUERY_REWRITE_SYSTEM_PROMPT,
    evidence_label="medical knowledge base",
    log_label="Healthcare",
    ambiguous_hints=(
        "this",
        "that",
        "it",
        "normal",
        "what about",
        "how about",
        "side effect",
        "side effects",
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


def _build_healthcare_prompt(query: str, prompt: str = ""):
    return rag.build_grounded_prompt(
        query,
        prompt,
        _PROFILE,
        _resolve_retrieval_query,
        search_medical_kb,
        format_kb_response,
    )


@register
class HealthcareSpecialist(rag.RagSpecialist):
    name = "healthcare"
    description = "Eye or ophthalmology related symptoms, medical conditions, treatment, medication, clinical questions."
    system_prompt = HEALTHCARE_SYSTEM_PROMPT

    def build_prompt(self, query: str, prompt: str):
        return _build_healthcare_prompt(query, prompt=prompt)

    def invoke(self, system_prompt: str, user_prompt: str) -> str:
        return invoke_model(system_prompt, user_prompt)

    def invoke_stream(self, system_prompt: str, user_prompt: str):
        return invoke_model_stream(system_prompt, user_prompt)
