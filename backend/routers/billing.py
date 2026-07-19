from fastapi import APIRouter
from pydantic import BaseModel
from services.billing_service import estimate_bill

router = APIRouter(prefix="/billing", tags=["Billing"])


class BillingRequest(BaseModel):
    record_class: str
    performer: str
    injections: int = 1


class BillingResponse(BaseModel):
    record_class: str
    performer: str
    injections: int
    estimated_cost_min: float
    estimated_cost_max: float
    max_medisave_claimable: float


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
