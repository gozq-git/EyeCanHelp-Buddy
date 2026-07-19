import pytest

from services.billing_service import estimate_bill


pytestmark = pytest.mark.unit


def test_estimate_bill_private_class_is_300():
    estimate = estimate_bill('PTE', 'Doctor', 1)
    assert estimate['estimated_cost_min'] == 430.0
    assert estimate['estimated_cost_max'] == 480.0
    assert estimate['max_medisave_claimable'] == 250.0


def test_estimate_bill_subsidised_class_is_200():
    estimate = estimate_bill('SUB', 'Nurse', 1)
    assert estimate['estimated_cost_min'] == 62.0
    assert estimate['estimated_cost_max'] == 220.0


def test_estimate_bill_unknown_class_falls_back_to_default():
    estimate = estimate_bill('UNKNOWN', 'Doctor', 2)
    assert estimate['estimated_cost_min'] == 246.0
    assert estimate['estimated_cost_max'] == 246.0


def test_estimate_bill_multiplies_by_number_of_injections():
    estimate = estimate_bill('SUB', 'Doctor', 2)
    assert estimate['estimated_cost_min'] == 172.0
    assert estimate['estimated_cost_max'] == 620.0
