# FHIR R4 resource: MedicationRequest
from pydantic import BaseModel


class IVTSchema(BaseModel):
    resourceType: str = "MedicationRequest"
    ivt_id: str
    ivt_name: str
    ivt_eyes: str          # "OD" | "OS" | "OU"
    ivt_medication: str    # e.g. "Eylea (Aflibercept)", "Lucentis (Ranibizumab)"

    model_config = {"from_attributes": True}
