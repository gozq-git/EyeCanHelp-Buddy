"""Answer-relevancy evals for the general-enquiry chatbot (live Bedrock + judge)."""
import pytest

pytest.importorskip(
    "deepeval", reason="deepeval is not installed — pip install -r requirements-dev.txt"
)

from deepeval.metrics import AnswerRelevancyMetric
from deepeval.test_case import LLMTestCase

from helpers import JUDGE_THRESHOLD, by_category, golden_id, load_goldens

pytestmark = pytest.mark.eval

# Answerable healthcare questions in every supported language.
ANSWERABLE = by_category(load_goldens(), "answerable", "multilingual")


@pytest.mark.parametrize("golden", ANSWERABLE, ids=golden_id)
def test_answer_relevancy(golden, run_agent, judge):
    state = run_agent(golden)
    reply = str(state.get("response", "")).strip()

    assert reply, f"[{golden['id']}] agent returned an empty reply"
    assert "could not generate a model response" not in reply.lower(), (
        f"[{golden['id']}] Bedrock call failed mid-flow: {reply[:200]}"
    )

    metric = AnswerRelevancyMetric(
        threshold=JUDGE_THRESHOLD, model=judge, include_reason=True
    )
    test_case = LLMTestCase(input=golden["input"], actual_output=reply)
    metric.measure(test_case)

    assert metric.score >= JUDGE_THRESHOLD, (
        f"[{golden['id']}] answer relevancy {metric.score:.2f} < {JUDGE_THRESHOLD} — "
        f"{metric.reason}"
    )
