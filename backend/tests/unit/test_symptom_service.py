"""Unit tests for UC3 post-injection symptom triage (services/symptom_service.py)."""
import pytest

from services.symptom_service import classify_symptoms, SymptomSeverity

pytestmark = pytest.mark.unit


# ── Severe classification ─────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "text",
    [
        "I see floaters and flashes of light",
        "sudden vision loss in my right eye",
        "severe pain and redness around the injection site",
        "there is discharge and swelling",
        "everything looks blurry",
        "a curtain is coming down over my vision",
    ],
)
def test_severe_symptoms_flagged(text):
    result = classify_symptoms(text)
    assert result["severity"] is SymptomSeverity.SEVERE
    assert "Emergency Department" in result["advice"] or "995" in result["advice"]


# ── Mild classification ───────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "text",
    [
        "just mild discomfort",
        "slight irritation in the eye",
        "my eye is a bit watery",
        "some light sensitivity",
        "it feels gritty and scratchy",
        "a foreign body sensation",
    ],
)
def test_mild_symptoms_flagged(text):
    result = classify_symptoms(text)
    assert result["severity"] is SymptomSeverity.MILD
    assert "mild" in result["advice"].lower()


# ── Unclear classification ────────────────────────────────────────────────────
@pytest.mark.parametrize("text", ["", "I feel fine today", "asdf qwerty"])
def test_unclassifiable_symptoms_are_unclear(text):
    result = classify_symptoms(text)
    assert result["severity"] is SymptomSeverity.UNCLEAR


# ── Edge / precedence behaviour ───────────────────────────────────────────────
def test_classification_is_case_insensitive():
    assert classify_symptoms("SEVERE PAIN")["severity"] is SymptomSeverity.SEVERE
    assert classify_symptoms("Mild Discomfort")["severity"] is SymptomSeverity.MILD


def test_severe_takes_precedence_over_mild():
    # Contains both a mild ("watery") and severe ("vision loss") keyword.
    result = classify_symptoms("my eye is watery and I have sudden vision loss")
    assert result["severity"] is SymptomSeverity.SEVERE


def test_every_branch_returns_advice_string():
    for text in ["floaters", "watery", "nothing relevant"]:
        result = classify_symptoms(text)
        assert isinstance(result["advice"], str) and result["advice"]
