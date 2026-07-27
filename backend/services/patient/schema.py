from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PatientSchema(BaseModel):
    resourceType: str = "Patient"
    patient_id: UUID
    patient_name: str
    patient_dob: date
    gender: str | None = None
    phone_number: str | None = None
    email: str | None = None
    status: str | None = None

    model_config = {"from_attributes": True}


class PatientRecordCreate(BaseModel):
    patient_id: str
    record_name: str
    record_diagnosis: str
    record_eyes: str
    record_number_of_injections: int
    record_validity_of_consent: bool
    record_last3mths_admission: bool
    record_stroke_heartAtt_last6mths: bool
    record_taking_antibiotics: bool
    record_pregnant: bool
    record_class: str | None = None
    record_performer: str | None = None


class PatientRecordResponse(PatientRecordCreate):
    resourceType: str = "DiagnosticReport"
    record_id: str
    record_medication: str | None = None
    issued: datetime = Field(default_factory=datetime.utcnow)


class IVTSchema(BaseModel):
    resourceType: str = "MedicationRequest"
    ivt_id: str
    ivt_name: str
    ivt_eyes: str
    ivt_medication: str

    model_config = {"from_attributes": True}


class PatientCreate(BaseModel):
    patient_name: str
    patient_dob: date
    gender: str | None = None
    phone_number: str | None = None
    email: str | None = None
    status: str | None = None


__all__ = [
    "PatientCreate",
    "PatientSchema",
    "PatientRecordCreate",
    "PatientRecordResponse",
    "IVTSchema",
]
