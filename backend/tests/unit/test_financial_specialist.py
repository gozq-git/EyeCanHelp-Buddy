import sys
from pathlib import Path

import pytest

COORDINATOR_DIR = Path(__file__).resolve().parents[2] / "agents" / "coordinator"
if str(COORDINATOR_DIR) not in sys.path:
    # Append instead of prepend so backend/main.py keeps precedence for `import main`.
    sys.path.append(str(COORDINATOR_DIR))

from specialists import financial

pytestmark = pytest.mark.unit


def test_resolve_retrieval_query_returns_original_when_disabled(monkeypatch):
    monkeypatch.setenv("FINANCIAL_QUERY_REWRITE_ENABLED", "false")
    query = "is that better"

    assert financial._resolve_retrieval_query(query, prompt="") == query


def test_resolve_retrieval_query_rewrites_when_enabled_and_ambiguous(monkeypatch):
    monkeypatch.setenv("FINANCIAL_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setattr(
        financial,
        "_rewrite_for_retrieval",
        lambda _q, previous_chat_context=None: "medical bill payment plan options with medisave and insurance limits",
    )

    rewritten = financial._resolve_retrieval_query("is that better", prompt="")

    assert rewritten == "medical bill payment plan options with medisave and insurance limits"


def test_resolve_retrieval_query_keeps_original_when_not_triggered(monkeypatch):
    monkeypatch.setenv("FINANCIAL_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setenv("FINANCIAL_QUERY_REWRITE_MAX_WORDS", "3")

    query = "Repayment plan for medical invoices over twelve months"
    assert financial._resolve_retrieval_query(query, prompt="") == query


def test_rewrite_for_retrieval_includes_previous_chat_context(monkeypatch):
    captured = {}

    def _fake_invoke_model(_system_prompt, user_prompt):
        captured["user_prompt"] = user_prompt
        return "rewritten standalone financial query with context"

    monkeypatch.setattr(financial, "invoke_model", _fake_invoke_model)

    result = financial._rewrite_for_retrieval(
        "is that better",
        previous_chat_context=[
            "SYSTEM: You are a financial assistant.",
            "USER: My total bill is 1200 and I can only pay 200 monthly",
            "ASSISTANT: We can compare installment options and subsidy pathways.",
        ],
    )

    assert "Previous chat context:" in captured["user_prompt"]
    assert "SYSTEM: You are a financial assistant." in captured["user_prompt"]
    assert "USER: My total bill is 1200 and I can only pay 200 monthly" in captured["user_prompt"]
    assert "ASSISTANT: We can compare installment options and subsidy pathways." in captured[
        "user_prompt"
    ]
    assert result == "rewritten standalone financial query with context"


def test_resolve_previous_chat_context_excludes_latest_when_matching_query():
    transcript = (
        "SYSTEM: You are a financial assistant\n"
        "USER: first payment question\n"
        "ASSISTANT: follow up\n"
        "USER: is that better"
    )

    turns = financial._resolve_previous_chat_context("is that better", transcript)

    assert turns == [
        "SYSTEM: You are a financial assistant",
        "USER: first payment question",
        "ASSISTANT: follow up",
    ]


def test_sanitize_rewrite_falls_back_on_invalid_output():
    original = "is that better"
    assert financial._sanitize_rewrite("No rewrite needed", original) == original
    assert financial._sanitize_rewrite("ok", original) == original


def test_build_financial_prompt_uses_kb_results(monkeypatch):
    monkeypatch.setenv("FINANCIAL_QUERY_REWRITE_ENABLED", "true")
    monkeypatch.setattr(
        financial,
        "_rewrite_for_retrieval",
        lambda _q, previous_chat_context=None: "hospital bill repayment options with subsidy eligibility",
    )

    observed = {}

    def _fake_search(query):
        observed["query"] = query
        return [{"rank": 1, "content": "Use a monthly 50/30/20 budget.", "score": 0.9}]

    monkeypatch.setattr(financial, "search_financial_kb", _fake_search)
    monkeypatch.setattr(
        financial,
        "format_financial_kb_response",
        lambda _query, _results: "Information retrieved from the financial knowledge base:\n- Use a monthly 50/30/20 budget.",
    )

    prompt, results = financial._build_financial_prompt("How do I budget for medical bills?")

    assert observed["query"] == "hospital bill repayment options with subsidy eligibility"
    assert "User query:\nHow do I budget for medical bills?" in prompt
    assert "Query used for retrieval:\nhospital bill repayment options with subsidy eligibility" in prompt
    assert "Retrieved financial knowledge base evidence:" in prompt
    assert len(results) == 1


def test_handle_returns_no_info_on_kb_error(monkeypatch):
    monkeypatch.setattr(
        financial,
        "_build_financial_prompt",
        lambda _query, prompt="": (None, [{"error": "kb unavailable"}]),
    )

    specialist = financial.FinancialSpecialist()
    result = specialist.handle({"prompt": "help with bills"})

    assert result["response"] == "No information available."
    assert result["kb_results"] == [{"error": "kb unavailable"}]


def test_handle_uses_model_with_grounded_prompt(monkeypatch):
    monkeypatch.setattr(
        financial,
        "_build_financial_prompt",
        lambda _query, prompt="": (
            "User query:\nhelp\n\nRetrieved financial knowledge base evidence:\n- evidence",
            [{"rank": 1, "content": "evidence", "score": 0.8}],
        ),
    )
    monkeypatch.setattr(financial, "invoke_model", lambda _sys, _prompt: "Grounded answer")

    specialist = financial.FinancialSpecialist()
    result = specialist.handle({"prompt": "help with bills"})

    assert result["response"] == "Grounded answer"
    assert len(result["kb_results"]) == 1
