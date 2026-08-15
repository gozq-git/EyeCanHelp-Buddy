"""Unit tests for the shared specialist RAG machinery (specialists/rag.py).

These cover the behaviour that used to be duplicated in financial.py and
healthcare.py, plus the RagSpecialist base contract.
"""
import sys
from pathlib import Path

import pytest

COORDINATOR_DIR = Path(__file__).resolve().parents[2] / "agents" / "coordinator"
if str(COORDINATOR_DIR) not in sys.path:
    # Append so backend/main.py keeps precedence for `import main`.
    sys.path.append(str(COORDINATOR_DIR))

from specialists import rag

pytestmark = pytest.mark.unit

_PROFILE = rag.RagProfile(
    env_prefix="TESTSPEC",
    rewrite_system_prompt="rewrite this",
    evidence_label="test knowledge base",
    log_label="Test",
)


class _Logger:
    def __init__(self):
        self.messages = []

    def info(self, fmt, *args):
        self.messages.append(fmt % args)


# ── RagProfile ────────────────────────────────────────────────────────────────
def test_profile_supplies_default_ambiguous_hints():
    assert "this" in _PROFILE.ambiguous_hints
    assert "how about" in _PROFILE.ambiguous_hints


# ── env_bool ──────────────────────────────────────────────────────────────────
def test_env_bool_returns_default_when_unset(monkeypatch):
    monkeypatch.delenv("SOME_FLAG", raising=False)

    assert rag.env_bool("SOME_FLAG", default=True) is True
    assert rag.env_bool("SOME_FLAG") is False


@pytest.mark.parametrize("raw,expected", [("1", True), ("TRUE", True), (" yes ", True),
                                          ("on", True), ("0", False), ("no", False), ("", False)])
def test_env_bool_parses_truthy_strings(monkeypatch, raw, expected):
    monkeypatch.setenv("SOME_FLAG", raw)

    assert rag.env_bool("SOME_FLAG", default=True) is expected


# ── rewrite_word_threshold ────────────────────────────────────────────────────
def test_rewrite_word_threshold_defaults_to_eight(monkeypatch):
    monkeypatch.delenv("TESTSPEC_QUERY_REWRITE_MAX_WORDS", raising=False)

    assert rag.rewrite_word_threshold("TESTSPEC") == 8


def test_rewrite_word_threshold_falls_back_on_garbage(monkeypatch):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_MAX_WORDS", "not-a-number")

    assert rag.rewrite_word_threshold("TESTSPEC") == 8


@pytest.mark.parametrize("raw,expected", [("1", 3), ("3", 3), ("12", 12), ("20", 20), ("99", 20)])
def test_rewrite_word_threshold_clamps(monkeypatch, raw, expected):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_MAX_WORDS", raw)

    assert rag.rewrite_word_threshold("TESTSPEC") == expected


# ── should_rewrite_query ──────────────────────────────────────────────────────
def test_should_rewrite_query_ignores_blank_input():
    assert rag.should_rewrite_query("   ", _PROFILE) is False


def test_should_rewrite_query_triggers_on_short_input(monkeypatch):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_MAX_WORDS", "8")

    assert rag.should_rewrite_query("is that ok", _PROFILE) is True


def test_should_rewrite_query_triggers_on_ambiguous_hint(monkeypatch):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_MAX_WORDS", "3")

    long_ambiguous = "what about the recovery timeline after the procedure is done"
    assert rag.should_rewrite_query(long_ambiguous, _PROFILE) is True


def test_should_rewrite_query_skips_long_standalone_input(monkeypatch):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_MAX_WORDS", "3")

    # Hints are matched as substrings, so this query deliberately avoids words
    # containing "it" / "that" / "this" (e.g. "intravitreal" contains "it").
    query = "explain post surgery recovery steps for eye lens replacement"
    assert rag.should_rewrite_query(query, _PROFILE) is False


# ── sanitize_rewrite ──────────────────────────────────────────────────────────
@pytest.mark.parametrize("candidate", ["", "   ", "too short", "No rewrite needed", "unchanged", "n/a"])
def test_sanitize_rewrite_falls_back_on_unusable_output(candidate):
    assert rag.sanitize_rewrite(candidate, "original query") == "original query"


def test_sanitize_rewrite_keeps_first_line_and_strips_quotes():
    assert rag.sanitize_rewrite('"a proper standalone query"\nextra', "fallback") == (
        "a proper standalone query"
    )


def test_sanitize_rewrite_truncates_to_forty_words():
    long_query = " ".join(f"word{i}" for i in range(60))

    assert len(rag.sanitize_rewrite(long_query, "fallback").split()) == 40


# ── chat context ──────────────────────────────────────────────────────────────
def test_extract_chat_turns_drops_blank_lines():
    assert rag.extract_chat_turns("a\n\n  \nb") == ["a", "b"]


def test_extract_chat_turns_handles_none():
    assert rag.extract_chat_turns(None) == []


def test_resolve_previous_chat_context_removes_the_latest_turn():
    transcript = "SYSTEM: hi\nUSER: first\nASSISTANT: reply\nUSER: is that normal"

    assert rag.resolve_previous_chat_context("is that normal", transcript) == [
        "SYSTEM: hi",
        "USER: first",
        "ASSISTANT: reply",
    ]


def test_resolve_previous_chat_context_keeps_all_turns_when_unmatched():
    assert rag.resolve_previous_chat_context("absent", "USER: something else") == [
        "USER: something else"
    ]


def test_resolve_previous_chat_context_handles_empty_prompt():
    assert rag.resolve_previous_chat_context("q", "") == []


# ── rewrite_for_retrieval ─────────────────────────────────────────────────────
def test_rewrite_for_retrieval_includes_history():
    seen = {}

    def _invoke(system_prompt, user_prompt):
        seen["system"] = system_prompt
        seen["user"] = user_prompt
        return "a standalone rewritten query"

    out = rag.rewrite_for_retrieval("is that ok", ["USER: earlier"], _PROFILE, _invoke)

    assert out == "a standalone rewritten query"
    assert seen["system"] == "rewrite this"
    assert "Previous chat context:\nUSER: earlier" in seen["user"]


def test_rewrite_for_retrieval_omits_empty_history():
    seen = {}

    def _invoke(_system, user_prompt):
        seen["user"] = user_prompt
        return "a standalone rewritten query"

    rag.rewrite_for_retrieval("is that ok", None, _PROFILE, _invoke)

    assert "Previous chat context:" not in seen["user"]


# ── resolve_retrieval_query ───────────────────────────────────────────────────
def test_resolve_retrieval_query_returns_empty_for_blank():
    logger = _Logger()

    assert rag.resolve_retrieval_query("  ", "", _PROFILE, lambda *a, **kw: "x", logger) == ""


def test_resolve_retrieval_query_respects_disable_flag(monkeypatch):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_ENABLED", "false")
    logger = _Logger()

    out = rag.resolve_retrieval_query("is that ok", "", _PROFILE, lambda *a, **kw: "rewritten", logger)

    assert out == "is that ok"


def test_resolve_retrieval_query_skips_rewrite_when_not_triggered(monkeypatch):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_MAX_WORDS", "3")
    logger = _Logger()

    query = "explain post surgery recovery steps for eye lens replacement"
    out = rag.resolve_retrieval_query(query, "", _PROFILE, lambda *a, **kw: "rewritten", logger)

    assert out == query
    assert logger.messages == []


def test_resolve_retrieval_query_logs_applied_rewrite(monkeypatch):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_ENABLED", "true")
    logger = _Logger()

    out = rag.resolve_retrieval_query(
        "is that ok", "", _PROFILE, lambda *a, **kw: "standalone rewritten query", logger
    )

    assert out == "standalone rewritten query"
    assert "Test KB rewrite applied" in logger.messages[0]


def test_resolve_retrieval_query_does_not_log_unchanged_rewrite(monkeypatch):
    monkeypatch.setenv("TESTSPEC_QUERY_REWRITE_ENABLED", "true")
    logger = _Logger()

    rag.resolve_retrieval_query("is that ok", "", _PROFILE, lambda *a, **kw: "is that ok", logger)

    assert logger.messages == []


# ── build_grounded_prompt ─────────────────────────────────────────────────────
def _build(search_results, formatted="Evidence:\n- a fact", query="How much?", resolved=None):
    return rag.build_grounded_prompt(
        query,
        "",
        _PROFILE,
        lambda q, prompt="": resolved if resolved is not None else q,
        lambda _q: search_results,
        lambda _r: formatted,
    )


def test_build_grounded_prompt_returns_none_without_results():
    assert _build([]) == (None, [])


def test_build_grounded_prompt_returns_none_on_kb_error():
    results = [{"error": "kb unavailable"}]

    assert _build(results) == (None, results)


def test_build_grounded_prompt_returns_none_on_empty_context():
    results = [{"content": "x"}]

    assert _build(results, formatted="") == (None, results)


def test_build_grounded_prompt_returns_none_when_kb_found_nothing():
    results = [{"content": "x"}]

    assert _build(results, formatted="I could not find relevant information here.") == (None, results)


def test_build_grounded_prompt_embeds_evidence_and_label():
    prompt, results = _build([{"content": "x"}])

    assert "User query:\nHow much?" in prompt
    assert "Retrieved test knowledge base evidence:" in prompt
    assert "Evidence:\n- a fact" in prompt
    assert "Query used for retrieval:" not in prompt
    assert len(results) == 1


def test_build_grounded_prompt_notes_a_rewritten_query():
    prompt, _results = _build([{"content": "x"}], resolved="rewritten standalone query")

    assert "Query used for retrieval:\nrewritten standalone query" in prompt


# ── RagSpecialist ─────────────────────────────────────────────────────────────
class _Spec(rag.RagSpecialist):
    name = "testspec"
    description = "test"
    system_prompt = "system"

    def __init__(self, prompt=("grounded", [{"content": "x"}]), answer="an answer", tokens=None):
        self._prompt = prompt
        self._answer = answer
        self._tokens = tokens if tokens is not None else ["an ", "answer"]
        self.seen = {}

    def build_prompt(self, query, prompt):
        self.seen["query"] = query
        self.seen["prompt"] = prompt
        return self._prompt

    def invoke(self, system_prompt, user_prompt):
        self.seen["system"] = system_prompt
        return self._answer

    def invoke_stream(self, system_prompt, user_prompt):
        self.seen["system"] = system_prompt
        return iter(self._tokens)


def test_rag_specialist_hooks_are_abstract():
    bare = rag.RagSpecialist()

    with pytest.raises(NotImplementedError):
        bare.build_prompt("q", "p")
    with pytest.raises(NotImplementedError):
        bare.invoke("s", "u")
    with pytest.raises(NotImplementedError):
        bare.invoke_stream("s", "u")


def test_handle_prefers_kb_query_over_prompt():
    spec = _Spec()

    spec.handle({"prompt": "USER: full transcript", "kb_query": "just the question"})

    assert spec.seen["query"] == "just the question"
    assert spec.seen["prompt"] == "USER: full transcript"


def test_handle_falls_back_to_prompt_without_kb_query():
    spec = _Spec()

    spec.handle({"prompt": "the prompt"})

    assert spec.seen["query"] == "the prompt"


def test_handle_returns_the_model_answer():
    result = _Spec().handle({"prompt": "q"})

    assert result == {"kb_results": [{"content": "x"}], "response": "an answer"}


def test_handle_returns_no_info_without_a_grounded_prompt():
    spec = _Spec(prompt=(None, [{"error": "kb down"}]))

    result = spec.handle({"prompt": "q"})

    assert result == {"kb_results": [{"error": "kb down"}], "response": rag.NO_INFO}


def test_handle_returns_no_info_for_a_blank_answer():
    result = _Spec(answer="   ").handle({"prompt": "q"})

    assert result["response"] == rag.NO_INFO


def test_handle_stream_yields_non_empty_tokens():
    spec = _Spec(tokens=["A ", "", "cataract", None])

    assert list(spec.handle_stream({"prompt": "q"})) == ["A ", "cataract"]
    assert spec.seen["system"] == "system"


def test_handle_stream_yields_no_info_without_a_grounded_prompt():
    spec = _Spec(prompt=(None, []))

    assert list(spec.handle_stream({"prompt": "q"})) == [rag.NO_INFO]


def test_handle_stream_yields_no_info_when_model_is_silent():
    spec = _Spec(tokens=["", None])

    assert list(spec.handle_stream({"prompt": "q"})) == [rag.NO_INFO]
