from datetime import datetime
from pydantic import BaseModel, Field


class AppointmentNotificationRequest(BaseModel):
    patient_id: str = Field(min_length=1)
    patient_name: str = Field(min_length=1)
    preferred_day: str = Field(min_length=1)
    preferred_period: str = Field(min_length=1)
    appointment_timezone: str = "Asia/Singapore"
    clinic_name: str = "TTSH Eye Clinic"
    requested_by: str = "chatbot"
    correlation_id: str | None = None
    idempotency_key: str | None = None


class AppointmentNotificationAccepted(BaseModel):
    status: str = "sent"
    delivery_message_id: str
    correlation_id: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)


__all__ = [
    "AppointmentNotificationRequest",
    "AppointmentNotificationAccepted",
]
