# FHIR R4 resource: Patient
from pydantic import BaseModel


class PatientSchema(BaseModel):
    resourceType: str = "Patient"
    patient_id: str
    patient_name: str
    patient_dob: str       # ISO date, e.g. "1960-04-15"
    phone_number: str | None = None

    model_config = {"from_attributes": True}
