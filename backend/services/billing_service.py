# UC2: Billing calculator for pre-procedure counselling

from typing import TypedDict


MAX_MEDISAVE_CLAIMABLE = 250.0

# Per-eye injection ranges by class and performer.
_PER_EYE_PRICE = {
    ("SUB", "DOCTOR"): (86.0, 310.0),
    ("SUB", "NURSE"): (62.0, 220.0),
    ("PTE", "DOCTOR"): (430.0, 480.0),
    ("PTE", "NURSE"): (300.0, 350.0),
}


class BillingEstimate(TypedDict):
    estimated_cost_min: float
    estimated_cost_max: float
    max_medisave_claimable: float


def estimate_bill(record_class: str | None, performer: str | None, injections: int | None) -> BillingEstimate:
    """Calculate total bill range for the selected class, performer and injections."""
    class_code = (record_class or "").upper()
    performer_code = (performer or "").upper()
    count = max(1, int(injections or 1))

    min_per_eye, max_per_eye = _PER_EYE_PRICE.get((class_code, performer_code), (123.0, 123.0))
    min_total = min_per_eye * count
    max_total = max_per_eye * count
    return {
        "estimated_cost_min": min_total,
        "estimated_cost_max": max_total,
        "max_medisave_claimable": MAX_MEDISAVE_CLAIMABLE,
    }
