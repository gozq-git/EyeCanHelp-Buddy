from fastapi import APIRouter

from .schema import BillingRequest, BillingResponse
from .service import estimate_bill

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.post("/calculate", response_model=BillingResponse)
def calculate_billing(request: BillingRequest):
    class_code = (request.record_class or "").upper()
    performer = (request.performer or "").capitalize()
    estimate = estimate_bill(class_code, performer, request.injections)
    return BillingResponse(
        record_class=class_code,
        performer=performer,
        injections=max(1, request.injections),
        estimated_cost_min=estimate["estimated_cost_min"],
        estimated_cost_max=estimate["estimated_cost_max"],
        max_medisave_claimable=estimate["max_medisave_claimable"],
    )
