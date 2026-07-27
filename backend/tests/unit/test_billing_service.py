import pytest
from unittest.mock import AsyncMock

from services.billing.service import BillingPriceNotConfiguredError, InvalidBillingClassError, estimate_bill_from_db


pytestmark = pytest.mark.unit


class _Result:
    def __init__(self, rate):
        self._rate = rate

    def scalar_one_or_none(self):
        return self._rate


class _Rate:
    def __init__(self, min_per_injection, max_per_injection, max_medisave_claimable):
        self.min_per_injection = min_per_injection
        self.max_per_injection = max_per_injection
        self.max_medisave_claimable = max_medisave_claimable


@pytest.mark.asyncio
async def test_estimate_bill_from_db_uses_rate_row():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result(_Rate(430.0, 480.0, 250.0)))

    estimate = await estimate_bill_from_db("PTE", "Doctor", 2, db)

    assert estimate["estimated_cost_min"] == 860.0
    assert estimate["estimated_cost_max"] == 960.0
    assert estimate["max_medisave_claimable"] == 250.0


@pytest.mark.asyncio
async def test_estimate_bill_from_db_raises_when_rate_missing():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result(None))

    with pytest.raises(BillingPriceNotConfiguredError):
        await estimate_bill_from_db("PRIVATE", "Doctor", 2, db)


@pytest.mark.asyncio
async def test_estimate_bill_from_db_defaults_injections_to_one():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result(_Rate(62.0, 220.0, 250.0)))

    estimate = await estimate_bill_from_db("SUB", "Nurse", 0, db)

    assert estimate["estimated_cost_min"] == 62.0
    assert estimate["estimated_cost_max"] == 220.0


@pytest.mark.asyncio
async def test_estimate_bill_from_db_accepts_private_aliases():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result(_Rate(430.0, 480.0, 250.0)))

    estimate = await estimate_bill_from_db("private", "Doctor", 2, db)

    assert estimate["estimated_cost_min"] == 860.0
    assert estimate["estimated_cost_max"] == 960.0


@pytest.mark.asyncio
async def test_estimate_bill_from_db_accepts_subsidised_aliases():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result(_Rate(62.0, 220.0, 250.0)))

    estimate = await estimate_bill_from_db("subsidised", "Nurse", 1, db)

    assert estimate["estimated_cost_min"] == 62.0
    assert estimate["estimated_cost_max"] == 220.0


@pytest.mark.asyncio
async def test_estimate_bill_from_db_rejects_unknown_class():
    db = AsyncMock()

    with pytest.raises(InvalidBillingClassError):
        await estimate_bill_from_db("corporate", "Doctor", 1, db)
