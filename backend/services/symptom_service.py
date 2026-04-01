# UC3: Post-injection symptom triage — classifies mild vs severe
from enum import Enum

SEVERE_KEYWORDS = [
    "floaters", "flashes", "flash", "sudden vision loss", "vision loss",
    "severe pain", "eye pain", "redness", "discharge", "swelling",
    "blurry", "blurred vision", "double vision", "curtain",
]

MILD_KEYWORDS = [
    "mild discomfort", "slight irritation", "tearing", "watery", "light sensitivity",
    "gritty", "scratchy", "foreign body sensation",
]


class SymptomSeverity(str, Enum):
    MILD = "mild"
    SEVERE = "severe"
    UNCLEAR = "unclear"


def classify_symptoms(symptom_text: str) -> dict:
    text_lower = symptom_text.lower()

    for kw in SEVERE_KEYWORDS:
        if kw in text_lower:
            return {
                "severity": SymptomSeverity.SEVERE,
                "advice": (
                    "Your symptoms may indicate a serious complication such as endophthalmitis or retinal detachment. "
                    "Please proceed to the Emergency Department (A&E) immediately or call 995."
                ),
            }

    for kw in MILD_KEYWORDS:
        if kw in text_lower:
            return {
                "severity": SymptomSeverity.MILD,
                "advice": (
                    "Your symptoms appear mild and are common after an IVT injection. "
                    "Monitor for 24-48 hours. If symptoms worsen, contact the clinic or go to A&E."
                ),
            }

    return {
        "severity": SymptomSeverity.UNCLEAR,
        "advice": (
            "We could not clearly classify your symptoms. "
            "Please contact the clinic at your earliest convenience or visit A&E if you are concerned."
        ),
    }
