"""Shared retrieval-augmented-generation machinery for KB-backed specialists.

`financial.py` and `healthcare.py` were byte-identical for ~80 lines each (query
rewriting, chat-context resolution, prompt assembly, handle/handle_stream). That
logic lives here once; each specialist supplies only what actually differs via a
`RagProfile` plus thin module-level wrappers.

The wrappers matter: every callable the shared code needs is passed in by the
specialist module rather than imported here, so `monkeypatch.setattr(financial,
"invoke_model", ...)` still reaches it. Names are resolved when the wrapper body
runs, not at import time.
"""
import os
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Any

from specialists.base import CoordinatorState, Specialist

NO_INFO = "No information available."

_DEFAULT_AMBIGUOUS_HINTS = (
    "this",
    "that",
    "it",
    "normal",
    "what about",
    "how about",
)


@dataclass(frozen=True)
class RagProfile:
    """The per-specialist knobs on top of the shared RAG behaviour."""

    env_prefix: str
    """Prefix for the QUERY_REWRITE_ENABLED / _MAX_WORDS env vars, e.g. "FINANCIAL"."""

    rewrite_system_prompt: str
    evidence_label: str
    """Goes into "Retrieved {evidence_label} evidence:" in the grounded prompt."""

    log_label: str
    ambiguous_hints: tuple[str, ...] = field(default=_DEFAULT_AMBIGUOUS_HINTS)


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def rewrite_word_threshold(env_prefix: str) -> int:
    raw = os.getenv(f"{env_prefix}_QUERY_REWRITE_MAX_WORDS", "8")
    try:
        threshold = int(raw)
    except ValueError:
        return 8
    return min(max(threshold, 3), 20)


def should_rewrite_query(query: str, profile: RagProfile) -> bool:
    cleaned = (query or "").strip().lower()
    if not cleaned:
        return False

    words = cleaned.split()
    is_short = len(words) <= rewrite_word_threshold(profile.env_prefix)
    has_ambiguous_hint = any(hint in cleaned for hint in profile.ambiguous_hints)
    return is_short or has_ambiguous_hint


def sanitize_rewrite(candidate: str, fallback: str) -> str:
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


def extract_chat_turns(prompt: str) -> list[str]:
    return [line.strip() for line in (prompt or "").splitlines() if line.strip()]


def resolve_previous_chat_context(query: str, prompt: str) -> list[str]:
    turns = extract_chat_turns(prompt)
    if not turns:
        return []

    latest = (query or "").strip()
    for idx in range(len(turns) - 1, -1, -1):
        line = turns[idx]
        if line.upper().startswith("USER:") and line[5:].strip() == latest:
            return turns[:idx] + turns[idx + 1 :]

    return turns


def rewrite_for_retrieval(
    query: str,
    previous_chat_context: list[str] | None,
    profile: RagProfile,
    invoke_model: Callable[[str, str], str],
) -> str:
    context_block = ""
    turns = previous_chat_context or []
    if turns:
        history = "\n".join(turns)
        context_block = f"Previous chat context:\n{history}\n\n"

    model_output = invoke_model(
        profile.rewrite_system_prompt,
        f"{context_block}User message:\n{query}\n\nStandalone retrieval query:",
    )
    return sanitize_rewrite(model_output, query)


def resolve_retrieval_query(
    query: str,
    prompt: str,
    profile: RagProfile,
    rewrite: Callable[..., str],
    logger,
) -> str:
    cleaned = (query or "").strip()
    if not cleaned:
        return ""

    if not env_bool(f"{profile.env_prefix}_QUERY_REWRITE_ENABLED", default=True):
        return cleaned

    if not should_rewrite_query(cleaned, profile):
        return cleaned

    previous_chat_context = resolve_previous_chat_context(cleaned, prompt)
    rewritten = rewrite(cleaned, previous_chat_context=previous_chat_context)
    if rewritten != cleaned:
        logger.info("%s KB rewrite applied: '%s' -> '%s'", profile.log_label, cleaned, rewritten)
    return rewritten


def build_grounded_prompt(
    query: str,
    prompt: str,
    profile: RagProfile,
    resolve_query: Callable[..., str],
    search: Callable[[str], list[dict[str, Any]]],
    format_results: Callable[[list[dict[str, Any]]], str],
) -> tuple[str | None, list[dict[str, Any]]]:
    """Retrieve KB evidence and wrap it in a grounded prompt.

    Returns `(None, results)` whenever there is nothing usable to ground on, so
    the caller can fall back to NO_INFO.
    """
    original_query = (query or "").strip()
    retrieval_query = resolve_query(original_query, prompt=prompt)

    results = search(retrieval_query)
    if not results:
        return None, []

    if any("error" in item for item in results if isinstance(item, dict)):
        return None, results

    kb_context = format_results(results)
    if not kb_context or "could not find relevant information" in kb_context.lower():
        return None, results

    retrieval_note = ""
    if retrieval_query and retrieval_query != original_query:
        retrieval_note = f"Query used for retrieval:\n{retrieval_query}\n\n"

    grounded_prompt = (
        f"User query:\n{original_query}\n\n"
        f"{retrieval_note}"
        f"Retrieved {profile.evidence_label} evidence:\n"
        f"{kb_context}\n\n"
        "Provide the best possible answer grounded only in the retrieved evidence."
    )
    return grounded_prompt, results


class RagSpecialist(Specialist):
    """Specialist that answers strictly from its knowledge base.

    Subclasses set `system_prompt` and implement the three hooks below as
    one-liners delegating to their own module globals, which is what keeps them
    monkeypatchable from the tests.
    """

    system_prompt = ""

    def build_prompt(self, query: str, prompt: str) -> tuple[str | None, list[dict[str, Any]]]:
        raise NotImplementedError

    def invoke(self, system_prompt: str, user_prompt: str) -> str:
        raise NotImplementedError

    def invoke_stream(self, system_prompt: str, user_prompt: str) -> Iterator[str]:
        raise NotImplementedError

    @staticmethod
    def _query_of(state: CoordinatorState) -> tuple[str, str]:
        prompt = state.get("prompt", "")
        return state.get("kb_query", prompt), prompt

    def handle(self, state: CoordinatorState) -> CoordinatorState:
        query, prompt = self._query_of(state)
        grounded_prompt, results = self.build_prompt(query, prompt)
        if not grounded_prompt:
            return {"kb_results": results, "response": NO_INFO}

        answer = self.invoke(self.system_prompt, grounded_prompt)
        if not answer.strip():
            return {"kb_results": results, "response": NO_INFO}

        return {"kb_results": results, "response": answer}

    def handle_stream(self, state: CoordinatorState) -> Iterator[str]:
        query, prompt = self._query_of(state)
        grounded_prompt, _results = self.build_prompt(query, prompt)
        if not grounded_prompt:
            yield NO_INFO
            return

        yielded = False
        for token in self.invoke_stream(self.system_prompt, grounded_prompt):
            if token:
                yielded = True
                yield token

        if not yielded:
            yield NO_INFO
