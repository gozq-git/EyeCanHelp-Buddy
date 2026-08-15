import sys
from pathlib import Path

import pytest

COORDINATOR_DIR = Path(__file__).resolve().parents[2] / "agents" / "coordinator"
if str(COORDINATOR_DIR) not in sys.path:
    # Append instead of prepend so backend/main.py keeps precedence for `import main`.
    sys.path.append(str(COORDINATOR_DIR))

from specialists import healthcare

pytestmark = pytest.mark.unit


def test_resolve_retrieval_query_returns_original_when_disabled(monkeypatch):
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_ENABLED", "false")
    query = "is that normal"

    assert healthcare._resolve_retrieval_query(query, prompt="") == query


def test_resolve_retrieval_query_rewrites_when_enabled_and_ambiguous(monkeypatch):
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setattr(
        healthcare,
        "_rewrite_for_retrieval",
        lambda _q, previous_chat_context=None: "post intravitreal injection eye redness and discharge normal recovery",
    )

    rewritten = healthcare._resolve_retrieval_query("is that normal", prompt="")

    assert rewritten == "post intravitreal injection eye redness and discharge normal recovery"


def test_resolve_retrieval_query_keeps_original_when_not_triggered(monkeypatch):
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_MAX_WORDS", "3")

    query = "What are warning signs of retinal detachment after injection"
    assert healthcare._resolve_retrieval_query(query, prompt="") == query


def test_rewrite_for_retrieval_includes_previous_chat_context(monkeypatch):
    captured = {}

    def _fake_invoke_model(_system_prompt, user_prompt):
        captured["user_prompt"] = user_prompt
        return "rewritten standalone query with context"

    monkeypatch.setattr(healthcare, "invoke_model", _fake_invoke_model)

    result = healthcare._rewrite_for_retrieval(
        "is that normal",
        previous_chat_context=[
            "SYSTEM: You are a safe assistant.",
            "USER: I got an eye injection yesterday and now it is red",
            "ASSISTANT: Please monitor symptoms and seek urgent care for severe pain.",
        ],
    )

    assert "Previous chat context:" in captured["user_prompt"]
    assert "SYSTEM: You are a safe assistant." in captured["user_prompt"]
    assert "USER: I got an eye injection yesterday and now it is red" in captured["user_prompt"]
    assert "ASSISTANT: Please monitor symptoms and seek urgent care for severe pain." in captured["user_prompt"]
    assert "I got an eye injection yesterday and now it is red" in captured["user_prompt"]
    assert result == "rewritten standalone query with context"


def test_resolve_previous_chat_context_excludes_latest_when_matching_query():
    transcript = (
        "SYSTEM: You are a safe assistant\n"
        "USER: first symptom\n"
        "ASSISTANT: follow up\n"
        "USER: is that normal"
    )

    turns = healthcare._resolve_previous_chat_context("is that normal", transcript)

    assert turns == [
        "SYSTEM: You are a safe assistant",
        "USER: first symptom",
        "ASSISTANT: follow up",
    ]


def test_sanitize_rewrite_falls_back_on_invalid_output():
    original = "is that normal"
    assert healthcare._sanitize_rewrite("No rewrite needed", original) == original
    assert healthcare._sanitize_rewrite("ok", original) == original


def test_build_healthcare_prompt_uses_rewritten_query_for_kb(monkeypatch):
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setattr(
        healthcare,
        "_rewrite_for_retrieval",
        lambda _q, previous_chat_context=None: "post injection eye pain severe warning signs",
    )

    observed = {}

    def _fake_search(query):
        observed["query"] = query
        return [{"rank": 1, "content": "Seek urgent care for severe pain.", "score": 0.9}]

    monkeypatch.setattr(healthcare, "search_medical_kb", _fake_search)
    monkeypatch.setattr(
        healthcare,
        "format_kb_response",
        lambda _results: "Information retrieved from the TTSH Library:\n- Seek urgent care.",
    )

    prompt, results = healthcare._build_healthcare_prompt("is that normal", prompt="")

    assert observed["query"] == "post injection eye pain severe warning signs"
    assert "User query:\nis that normal" in prompt
    assert "Query used for retrieval:\npost injection eye pain severe warning signs" in prompt
    assert len(results) == 1