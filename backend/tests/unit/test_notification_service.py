import base64

import pytest

from services.notifications.schema import AppointmentNotificationRequest
from services.notifications.service import (
    NotificationConfigError,
    NotificationDeliveryError,
    build_appointment_email,
    send_appointment_notification_email,
)

pytestmark = pytest.mark.unit


class _FakeSendRequest:
    def __init__(self, out):
        self._out = out

    def execute(self):
        return self._out


class _FakeMessages:
    def __init__(self, out=None, should_raise=False):
        self.out = out or {"id": "gmail-001"}
        self.should_raise = should_raise
        self.calls = []

    def send(self, **kwargs):
        self.calls.append(kwargs)
        if self.should_raise:
            raise RuntimeError("send failed")
        return _FakeSendRequest(self.out)


class _FakeUsers:
    def __init__(self, messages):
        self._messages = messages

    def messages(self):
        return self._messages


class _FakeGmailService:
    def __init__(self, messages):
        self._users = _FakeUsers(messages)

    def users(self):
        return self._users


def _request(**overrides):
    payload = {
        "patient_id": "P001",
        "patient_name": "Tan Ah Kow",
        "preferred_day": "Monday",
        "preferred_period": "AM",
        "appointment_timezone": "Asia/Singapore",
        "clinic_name": "TTSH Eye Clinic",
        "requested_by": "chatbot",
    }
    payload.update(overrides)
    return AppointmentNotificationRequest(**payload)


def test_build_appointment_email_contains_slot_and_reference():
    out = build_appointment_email(_request(), correlation_id="corr-001")
    assert out["subject"] == "Appointment request received for Tan Ah Kow"
    assert "Preferred slot: Monday (AM), Asia/Singapore." in out["text_body"]
    assert "Reference: corr-001" in out["text_body"]


@pytest.mark.asyncio
async def test_send_appointment_notification_requires_sender(monkeypatch):
    monkeypatch.delenv("GMAIL_SENDER_EMAIL", raising=False)
    with pytest.raises(NotificationConfigError):
        await send_appointment_notification_email(_request(), gmail_service=_FakeGmailService(_FakeMessages()))


@pytest.mark.asyncio
async def test_send_appointment_notification_success(monkeypatch):
    monkeypatch.setenv("GMAIL_SENDER_EMAIL", "eyecanhelpbuddy@gmail.com")
    monkeypatch.setenv("GMAIL_DESTINATION_EMAIL", "ops@example.com")
    fake_messages = _FakeMessages(out={"id": "gmail-123"})
    service = _FakeGmailService(fake_messages)

    out = await send_appointment_notification_email(_request(), gmail_service=service)

    assert out["delivery_message_id"] == "gmail-123"
    assert out["correlation_id"]
    assert len(fake_messages.calls) == 1
    assert fake_messages.calls[0]["userId"] == "me"
    assert "raw" in fake_messages.calls[0]["body"]
    raw_msg = fake_messages.calls[0]["body"]["raw"]
    decoded = base64.urlsafe_b64decode(raw_msg.encode("utf-8")).decode("utf-8").lower()
    assert "to: ops@example.com" in decoded


@pytest.mark.asyncio
async def test_send_appointment_notification_failure_wrapped(monkeypatch):
    monkeypatch.setenv("GMAIL_SENDER_EMAIL", "eyecanhelpbuddy@gmail.com")
    monkeypatch.setenv("GMAIL_DESTINATION_EMAIL", "ops@example.com")
    service = _FakeGmailService(_FakeMessages(should_raise=True))

    with pytest.raises(NotificationDeliveryError):
        await send_appointment_notification_email(_request(), gmail_service=service)
