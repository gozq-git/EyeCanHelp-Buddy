from datetime import datetime, timezone
from pydantic import BaseModel, Field


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
    issued: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    session_id: str | None = None
    mode: str | None = None


class ChatResponse(BaseModel):
    reply: str


class AcknowledgementRequest(BaseModel):
    patient_record: PatientRecordCreate


class AcknowledgementResponse(BaseModel):
    record: PatientRecordResponse
    message: str


__all__ = [
    "ChatMessage",
    "ChatRequest",
    "ChatResponse",
    "PatientRecordCreate",
    "PatientRecordResponse",
    "AcknowledgementRequest",
    "AcknowledgementResponse",
]
