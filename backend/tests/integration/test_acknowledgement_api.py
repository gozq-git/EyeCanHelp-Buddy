"""Integration tests for the UC2 acknowledgement endpoint.

Patient acknowledgement data is persisted to the in-memory fake Mongo wired by
the `client` fixture, so the submit → latest round-trip is exercised end-to-end.
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
}


def test_submit_acknowledgement_succeeds(client):
    resp = client.post("/api/acknowledgement", json=ACK_PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "Patient acknowledgement recorded successfully."
    assert body["record"]["record_id"].startswith("REC-P001-")


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


def test_four_acknowledgement_questions_round_trip(client):
    """The four pre-procedure questions (stroke/heart attack, hospitalisation,
    antibiotics, pregnancy) must persist through the API into Mongo and come
    back unchanged via /latest."""
    record = {
        **ACK_PAYLOAD["patient_record"],
        "record_stroke_heartAtt_last6mths": True,
        "record_last3mths_admission": True,
        "record_taking_antibiotics": True,
        "record_pregnant": True,
    }
    payload = {**ACK_PAYLOAD, "patient_record": record}

    resp = client.post("/api/acknowledgement", json=payload)
    assert resp.status_code == 200
    saved = resp.json()["record"]
    assert saved["record_stroke_heartAtt_last6mths"] is True
    assert saved["record_last3mths_admission"] is True
    assert saved["record_taking_antibiotics"] is True
    assert saved["record_pregnant"] is True

    latest = client.get("/api/acknowledgement/latest/P001").json()
    assert latest["record_stroke_heartAtt_last6mths"] is True
    assert latest["record_last3mths_admission"] is True
    assert latest["record_taking_antibiotics"] is True
    assert latest["record_pregnant"] is True


def test_acknowledgement_question_missing_is_rejected(client):
    """Each of the four questions is a required boolean — omitting one is a 422."""
    record = {k: v for k, v in ACK_PAYLOAD["patient_record"].items() if k != "record_taking_antibiotics"}
    payload = {**ACK_PAYLOAD, "patient_record": record}
    resp = client.post("/api/acknowledgement", json=payload)
    assert resp.status_code == 422
