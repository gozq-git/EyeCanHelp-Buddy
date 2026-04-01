# FHIR R4 resource: DiagnosticReport
# Stored in MongoDB (TBL_PATIENT_RECORDS)
from pydantic import BaseModel, Field
from datetime import datetime


class PatientRecordCreate(BaseModel):
    patient_id: str
    record_name: str
    record_diagnosis: str          # ICD-10: e.g. "H35.31" AMD, "H36.0" DME, "H34.8" RVO
    record_eyes: str               # "OD" | "OS" | "OU"
    record_number_of_injections: int
    record_validity_of_consent: bool
    record_last3mths_admission: bool
    record_stroke_heartAtt_last6mths: bool
    record_taking_antibiotics: bool
    record_pregnant: bool


class PatientRecordResponse(PatientRecordCreate):
    resourceType: str = "DiagnosticReport"
    record_id: str
    issued: datetime = Field(default_factory=datetime.utcnow)
