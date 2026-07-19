from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal


class PaymentSchema(BaseModel):
    resourceType: str = "Coverage"
    payment_id: str
    payment_name: str
    payment_diagnosis: str
    payment_maxMedisave: float
    payment_estCostPerInjection: float
    payment_mode: Literal[
        "Medishield Life / Integrated Plan",
        "CSC",
        "Medisave (Self)",
        "MAF",
        "Cash",
        "NOK Medisave",
        "Medisave",
        "MediShield",
        "CHAS",
    ]

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


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str


class AcknowledgementRequest(BaseModel):
    patient_record: PatientRecordCreate
    payment: PaymentSchema


class AcknowledgementResponse(BaseModel):
    record: PatientRecordResponse
    payment: PaymentSchema
    message: str


__all__ = [
    "ChatMessage",
    "ChatRequest",
    "ChatResponse",
    "PaymentSchema",
    "PatientRecordCreate",
    "PatientRecordResponse",
    "AcknowledgementRequest",
    "AcknowledgementResponse",
]
