import base64
import hashlib
import os
import uuid
from datetime import datetime, timezone
from email.mime.text import MIMEText

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .schema import AppointmentNotificationRequest


class NotificationConfigError(RuntimeError):
    pass


class NotificationDeliveryError(RuntimeError):
    pass


def _get_required_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise NotificationConfigError(f"{name} is required")
    return value


def _build_correlation_id(payload: AppointmentNotificationRequest) -> str:
    return payload.correlation_id or str(uuid.uuid4())


def _build_idempotency_key(payload: AppointmentNotificationRequest) -> str:
    destination_email = _get_required_env("GMAIL_DESTINATION_EMAIL")
    source = (
        payload.idempotency_key
        or f"{payload.patient_id}|{destination_email}|{payload.preferred_day}|{payload.preferred_period}"
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _resolve_destination_email(payload: AppointmentNotificationRequest) -> str:
    return _get_required_env("GMAIL_DESTINATION_EMAIL")


def build_appointment_email(payload: AppointmentNotificationRequest, correlation_id: str) -> dict:
    slot = f"{payload.preferred_day} ({payload.preferred_period}), {payload.appointment_timezone}"
    subject = f"Appointment request received for {payload.patient_name}"
    text_body = (
        f"Dear {payload.patient_name},\n\n"
        f"We have received your appointment preference at {payload.clinic_name}.\n"
        f"Preferred slot: {slot}.\n\n"
        f"Patient ID: {payload.patient_id}\n"
        f"Reference: {correlation_id}\n"
        f"Requested by: {payload.requested_by}\n"
        f"Requested at: {datetime.now(timezone.utc).isoformat()}\n\n"
        "Our clinic staff will contact you to confirm availability.\n\n"
        "Regards,\n"
        "EyeCanHelp Buddy"
    )
    return {
        "subject": subject,
        "text_body": text_body,
    }


def _build_gmail_service():
    client_id = _get_required_env("GMAIL_CLIENT_ID")
    client_secret = _get_required_env("GMAIL_CLIENT_SECRET")
    refresh_token = _get_required_env("GMAIL_REFRESH_TOKEN")
    token_uri = (os.getenv("GMAIL_TOKEN_URI") or "https://oauth2.googleapis.com/token").strip()

    creds = Credentials(
        None,
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.send"],
    )
    creds.refresh(Request())
    return build("gmail", "v1", credentials=creds)


def _create_gmail_raw_message(*, sender: str, recipient: str, subject: str, text_body: str) -> str:
    msg = MIMEText(text_body)
    msg["to"] = recipient
    msg["from"] = sender
    msg["subject"] = subject
    return base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")


async def send_appointment_notification_email(payload: AppointmentNotificationRequest, gmail_service=None) -> dict:
    sender_email = _get_required_env("GMAIL_SENDER_EMAIL")
    destination_email = _resolve_destination_email(payload)
    correlation_id = _build_correlation_id(payload)
    _ = _build_idempotency_key(payload)
    email_payload = build_appointment_email(payload, correlation_id)

    service = gmail_service or _build_gmail_service()
    raw = _create_gmail_raw_message(
        sender=sender_email,
        recipient=destination_email,
        subject=email_payload["subject"],
        text_body=email_payload["text_body"],
    )

    try:
        sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    except HttpError as exc:
        raise NotificationDeliveryError(f"Failed to send Gmail message: {exc}") from exc
    except Exception as exc:
        raise NotificationDeliveryError(f"Failed to send Gmail message: {exc}") from exc

    return {
        "delivery_message_id": sent.get("id", ""),
        "correlation_id": correlation_id,
    }


__all__ = [
    "NotificationConfigError",
    "NotificationDeliveryError",
    "build_appointment_email",
    "send_appointment_notification_email",
]
