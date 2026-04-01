# FHIR R4 resource: Coverage / Claim
from pydantic import BaseModel
from typing import Literal


class PaymentSchema(BaseModel):
    resourceType: str = "Coverage"
    payment_id: str
    payment_name: str
    payment_diagnosis: str                     # ICD-10 code
    payment_maxMedisave: float                 # SGD
    payment_estCostPerInjection: float         # SGD
    payment_mode: Literal["Medisave", "Cash", "MediShield", "CHAS"]

    model_config = {"from_attributes": True}
