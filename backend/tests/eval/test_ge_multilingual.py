"""Multilingual evals: replies must be written in the requested language.

Uses a GEval judge check per golden. Note this suite intentionally measures the
*current* product behaviour — if specialists answer in English regardless of the
LANGUAGE: header, these tests are expected to fail and expose that gap.
"""
import pytest

pytest.importorskip(
    "deepeval", reason="deepeval is not installed — pip install -r requirements-dev.txt"
)

from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, SingleTurnParams

from helpers import JUDGE_THRESHOLD, by_category, golden_id, load_goldens

pytestmark = pytest.mark.eval

MULTILINGUAL = by_category(load_goldens(), "multilingual")

LANGUAGE_NAMES = {"en": "English", "zh": "Chinese", "ms": "Malay", "ta": "Tamil"}


@pytest.mark.parametrize("golden", MULTILINGUAL, ids=golden_id)
def test_reply_language_fidelity(golden, run_agent, judge):
    state = run_agent(golden)
    reply = str(state.get("response", "")).strip()
    language = golden.get("language", "en")
    language_name = LANGUAGE_NAMES[language]

    assert reply, f"[{golden['id']}] agent returned an empty reply"

    metric = GEval(
        name="language-fidelity",
        criteria=(
            f"The user asked their question in {language_name}. Determine whether "
            f"the actual output is written entirely in {language_name}. Score 1.0 "
            f"only if the whole reply is in {language_name}; penalise replies that "
            "are mostly in another language (short unavoidable proper nouns such as "
            "hospital names are acceptable)."
        ),
        evaluation_params=[SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
        threshold=JUDGE_THRESHOLD,
        model=judge,
    )
    test_case = LLMTestCase(input=golden["input"], actual_output=reply)
    metric.measure(test_case)

    assert metric.score >= JUDGE_THRESHOLD, (
        f"[{golden['id']}] reply is not in {language_name} "
        f"(score {metric.score:.2f}) — {metric.reason}"
    )
