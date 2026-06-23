"""Integration tests for the UC1 EPIC lookup endpoints.

The EPIC facade (services.epic_service) is mocked so the route logic — including
the 404 paths — is verified without touching Postgres/Mongo.
"""
import pytest

from schemas.patient import PatientSchema
from schemas.patient_record import PatientRecordResponse

pytestmark = pytest.mark.integration


def test_get_patient_found(client, monkeypatch):
    async def fake_get_patient(patient_id):
        return PatientSchema(patient_id=patient_id, patient_name="Tan Ah Kow", patient_dob="1952-08-12")

    monkeypatch.setattr("routers.epic.get_patient_from_epic", fake_get_patient)

    resp = client.get("/api/epic/patient/P001")
    assert resp.status_code == 200
    body = resp.json()
    assert body["patient_id"] == "P001"
    assert body["resourceType"] == "Patient"


def test_get_patient_not_found(client, monkeypatch):
    async def fake_get_patient(patient_id):
        return None

    monkeypatch.setattr("routers.epic.get_patient_from_epic", fake_get_patient)

    resp = client.get("/api/epic/patient/UNKNOWN")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_get_patient_record_found(client, monkeypatch):
    async def fake_get_record(patient_id):
        return PatientRecordResponse(
            record_id=f"REC-{patient_id}-001",
            patient_id=patient_id,
            record_name="Tan Ah Kow",
            record_diagnosis="H35.31",
            record_eyes="OD",
            record_number_of_injections=3,
            record_validity_of_consent=True,
            record_last3mths_admission=False,
            record_stroke_heartAtt_last6mths=False,
            record_taking_antibiotics=False,
            record_pregnant=False,
        )

    monkeypatch.setattr("routers.epic.get_patient_record_from_epic", fake_get_record)

    resp = client.get("/api/epic/patient/P001/record")
    assert resp.status_code == 200
    assert resp.json()["record_id"] == "REC-P001-001"


def test_get_patient_record_not_found(client, monkeypatch):
    async def fake_get_record(patient_id):
        return None

    monkeypatch.setattr("routers.epic.get_patient_record_from_epic", fake_get_record)

    resp = client.get("/api/epic/patient/UNKNOWN/record")
    assert resp.status_code == 404
