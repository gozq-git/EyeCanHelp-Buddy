from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database.postgres import get_db

from .schema import BillingRequest, BillingResponse
from .service import (
    BillingPriceNotConfiguredError,
    InvalidBillingClassError,
    estimate_bill_from_db,
)

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.post("/calculate", response_model=BillingResponse)
async def calculate_billing(request: BillingRequest, db: AsyncSession = Depends(get_db)):
    class_code = (request.record_class or "").upper()
    performer = (request.performer or "").capitalize()
    try:
        estimate = await estimate_bill_from_db(
            class_code,
            performer,
            request.injections,
            db,
        )
    except InvalidBillingClassError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except BillingPriceNotConfiguredError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return BillingResponse(
        record_class=class_code,
        performer=performer,
        injections=max(1, request.injections),
        estimated_cost_min=estimate["estimated_cost_min"],
        estimated_cost_max=estimate["estimated_cost_max"],
        max_medisave_claimable=estimate["max_medisave_claimable"],
    )
