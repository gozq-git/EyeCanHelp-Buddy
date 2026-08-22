"""Faithfulness evals: healthcare answers must be grounded in the KB snippets.

Requires AWS_KNOWLEDGE_BASE_ID — without a real retrieval backend there is no
retrieval context to be faithful to, and these tests skip (via require_kb).
"""
import pytest

pytest.importorskip(
    "deepeval", reason="deepeval is not installed — pip install -r requirements-dev.txt"
)

from deepeval.metrics import FaithfulnessMetric
from deepeval.test_case import LLMTestCase

from helpers import JUDGE_THRESHOLD, by_category, golden_id, load_goldens, retrieval_context

pytestmark = pytest.mark.eval

ANSWERABLE = by_category(load_goldens(), "answerable")


@pytest.mark.parametrize("golden", ANSWERABLE, ids=golden_id)
def test_faithfulness_to_kb(golden, run_agent, judge, require_kb):
    state = run_agent(golden)
    reply = str(state.get("response", "")).strip()
    context = retrieval_context(state)

    assert context, (
        f"[{golden['id']}] no KB snippets captured — the healthcare specialist did "
        "not retrieve anything, so there is nothing to be faithful to"
    )

    metric = FaithfulnessMetric(
        threshold=JUDGE_THRESHOLD, model=judge, include_reason=True
    )
    test_case = LLMTestCase(
        input=golden["input"],
        actual_output=reply,
        retrieval_context=context,
    )
    metric.measure(test_case)

    assert metric.score >= JUDGE_THRESHOLD, (
        f"[{golden['id']}] faithfulness {metric.score:.2f} < {JUDGE_THRESHOLD} "
        f"(possible hallucination beyond the KB) — {metric.reason}"
    )
