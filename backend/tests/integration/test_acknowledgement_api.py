"""Integration tests for the UC2 acknowledgement endpoint.

Payment is persisted via the SQLite-backed get_db override; the patient record
is persisted to the in-memory fake Mongo. Both stores are wired by the `client`
fixture, so the submit → latest round-trip is exercised end-to-end.
"""
import pytest

pytestmark = pytest.mark.integration

ACK_PAYLOAD = {
    "patient_record": {
        "patient_id": "P001",
        "record_name": "Tan Ah Kow",
        "record_diagnosis": "H35.31",
        "record_eyes": "OD",
        "record_number_of_injections": 3,
        "record_validity_of_consent": True,
        "record_last3mths_admission": False,
        "record_stroke_heartAtt_last6mths": False,
        "record_taking_antibiotics": False,
        "record_pregnant": False,
    },
    "payment": {
        "payment_id": "PAY-TEST-001",
        "payment_name": "Medisave Standard",
        "payment_diagnosis": "H35.31",
        "payment_maxMedisave": 2150.0,
        "payment_estCostPerInjection": 123.0,
        "payment_mode": "Medisave",
    },
}


def test_submit_acknowledgement_succeeds(client):
    resp = client.post("/api/acknowledgement", json=ACK_PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "Patient acknowledgement recorded successfully."
    assert body["record"]["record_id"].startswith("REC-P001-")
    assert body["payment"]["payment_id"] == "PAY-TEST-001"


def test_submit_then_fetch_latest(client):
    client.post("/api/acknowledgement", json=ACK_PAYLOAD)
    latest = client.get("/api/acknowledgement/latest/P001")
    assert latest.status_code == 200
    assert latest.json()["patient_id"] == "P001"
    # _id is stripped before returning.
    assert "_id" not in latest.json()


def test_latest_returns_404_when_no_record(client):
    resp = client.get("/api/acknowledgement/latest/NOBODY")
    assert resp.status_code == 404


def test_submit_rejects_invalid_payment_mode(client):
    bad = {**ACK_PAYLOAD, "payment": {**ACK_PAYLOAD["payment"], "payment_mode": "Crypto"}}
    resp = client.post("/api/acknowledgement", json=bad)
    assert resp.status_code == 422
