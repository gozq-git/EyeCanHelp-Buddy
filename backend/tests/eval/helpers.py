"""Shared pure helpers for the eval suite (fixtures live in conftest.py).

Imported as a top-level module: pytest prepends tests/eval/ to sys.path when
collecting files from this directory (no __init__.py here, same as the other
test folders).
"""
import json
from pathlib import Path

DATASET_PATH = Path(__file__).resolve().parent / "datasets" / "general_enquiry_goldens.json"

# Lenient starting point for LLM-judged metrics. Tighten after a few baseline
# runs have established the realistic score distribution.
JUDGE_THRESHOLD = 0.5

# Fixed strings every localized escalation response must contain (all four
# languages embed the same phone numbers — see agent.py::_ESCALATION_TEXT).
ESCALATION_OFFICE_HOTLINE = "81263632"
ESCALATION_TTSH_OPERATOR = "6256 6011"

OUT_OF_SCOPE_MARKER = "only able to assist with queries related to eye"


def load_goldens() -> list[dict]:
    """Load the golden dataset (static JSON; safe to call at collection time)."""
    return json.loads(DATASET_PATH.read_text(encoding="utf-8"))["goldens"]


def by_category(goldens: list[dict], *categories: str) -> list[dict]:
    return [g for g in goldens if g.get("category") in categories]


def with_expected_route(goldens: list[dict]) -> list[dict]:
    return [g for g in goldens if g.get("expected_route")]


def retrieval_context(state: dict) -> list[str]:
    """KB snippet contents captured from the specialist's final graph state.

    The RAG specialists put the raw retrieval results into ``kb_results``; each
    item carries the snippet text under ``content`` (see tools/kb_tools.py).
    """
    return [
        str(item["content"])
        for item in state.get("kb_results", []) or []
        if isinstance(item, dict) and str(item.get("content", "")).strip()
    ]


def golden_id(golden: dict) -> str:
    """pytest param id."""
    return golden["id"]
