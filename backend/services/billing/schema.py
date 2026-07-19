from pydantic import BaseModel


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


__all__ = ["BillingRequest", "BillingResponse"]
