import sys
from pathlib import Path

import pytest

COORDINATOR_DIR = Path(__file__).resolve().parents[2] / "agents" / "coordinator"
if str(COORDINATOR_DIR) not in sys.path:
    sys.path.insert(0, str(COORDINATOR_DIR))

from specialists import healthcare

pytestmark = pytest.mark.unit


def test_resolve_retrieval_query_returns_original_when_disabled(monkeypatch):
    monkeypatch.delenv("HEALTHCARE_QUERY_REWRITE_ENABLED", raising=False)
    query = "is that normal"

    assert healthcare._resolve_retrieval_query(query) == query


def test_resolve_retrieval_query_rewrites_when_enabled_and_ambiguous(monkeypatch):
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setattr(
        healthcare,
        "_rewrite_for_retrieval",
        lambda _q: "post intravitreal injection eye redness and discharge normal recovery",
    )

    rewritten = healthcare._resolve_retrieval_query("is that normal")

    assert rewritten == "post intravitreal injection eye redness and discharge normal recovery"


def test_resolve_retrieval_query_keeps_original_when_not_triggered(monkeypatch):
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_MAX_WORDS", "3")

    query = "What are warning signs of retinal detachment after injection"
    assert healthcare._resolve_retrieval_query(query) == query


def test_sanitize_rewrite_falls_back_on_invalid_output():
    original = "is that normal"
    assert healthcare._sanitize_rewrite("No rewrite needed", original) == original
    assert healthcare._sanitize_rewrite("ok", original) == original


def test_build_healthcare_prompt_uses_rewritten_query_for_kb(monkeypatch):
    monkeypatch.setenv("HEALTHCARE_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setattr(
        healthcare,
        "_rewrite_for_retrieval",
        lambda _q: "post injection eye pain severe warning signs",
    )

    observed = {}

    def _fake_search(query):
        observed["query"] = query
        return [{"rank": 1, "content": "Seek urgent care for severe pain.", "score": 0.9}]

    monkeypatch.setattr(healthcare, "search_medical_kb", _fake_search)
    monkeypatch.setattr(
        healthcare,
        "format_kb_response",
        lambda _query, _results: "Information retrieved from the TTSH Library:\n- Seek urgent care.",
    )

    prompt, results = healthcare._build_healthcare_prompt("is that normal")

    assert observed["query"] == "post injection eye pain severe warning signs"
    assert "User query:\nis that normal" in prompt
    assert "Query used for retrieval:\npost injection eye pain severe warning signs" in prompt
    assert len(results) == 1