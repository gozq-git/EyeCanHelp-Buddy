import pytest

from services.notifications.service import NotificationDeliveryError

pytestmark = pytest.mark.integration


def _payload(**overrides):
    base = {
        "patient_id": "P001",
        "patient_name": "Tan Ah Kow",
        "preferred_day": "Monday",
        "preferred_period": "AM",
        "appointment_timezone": "Asia/Singapore",
        "clinic_name": "TTSH Eye Clinic",
        "requested_by": "chatbot",
    }
    base.update(overrides)
    return base


def test_enqueue_appointment_notification_accepted(client, monkeypatch):
    async def fake_send(request):
        assert request.patient_id == "P001"
        return {"delivery_message_id": "gmail-msg-123", "correlation_id": "corr-001"}

    monkeypatch.setattr(
        "services.notifications.router.send_appointment_notification_email",
        fake_send,
    )

    resp = client.post("/api/notifications/appointments", json=_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "sent"
    assert body["delivery_message_id"] == "gmail-msg-123"
    assert body["correlation_id"] == "corr-001"


def test_enqueue_appointment_notification_validation_error(client):
    payload = _payload()
    payload.pop("preferred_period")
    resp = client.post("/api/notifications/appointments", json=payload)
    assert resp.status_code == 422


def test_enqueue_appointment_notification_send_failure(client, monkeypatch):
    async def fake_send(_request):
        raise NotificationDeliveryError("boom")

    monkeypatch.setattr(
        "services.notifications.router.send_appointment_notification_email",
        fake_send,
    )

    resp = client.post("/api/notifications/appointments", json=_payload())
    assert resp.status_code == 502
    assert resp.json()["detail"] == "Unable to send appointment email"
