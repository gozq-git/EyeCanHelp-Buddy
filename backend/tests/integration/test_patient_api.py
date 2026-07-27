"""Integration tests for the patient CRUD endpoints backed by SQLAlchemy.

The `client` fixture overrides get_db with an in-memory SQLite session, so these
exercise the real ORM round-trip (insert + select) without PostgreSQL.
"""
import pytest
import uuid

pytestmark = pytest.mark.integration

NEW_PATIENT = {
    "patient_name": "New Patient",
    "patient_dob": "1970-01-01",
    "phone_number": "+6580000000",
}


def test_create_then_get_patient(client):
    create = client.post("/api/patient", json=NEW_PATIENT)
    assert create.status_code == 200
    created_id = create.json()["patient_id"]
    assert uuid.UUID(created_id)

    fetched = client.get(f"/api/patient/{created_id}")
    assert fetched.status_code == 200
    assert fetched.json()["patient_name"] == "New Patient"


def test_create_multiple_patients_succeeds_with_distinct_ids(client):
    first = client.post("/api/patient", json=NEW_PATIENT)
    second = client.post("/api/patient", json=NEW_PATIENT)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["patient_id"] != second.json()["patient_id"]


def test_get_unknown_patient_returns_404(client):
    resp = client.get("/api/patient/DOES-NOT-EXIST")
    assert resp.status_code == 404


def test_create_patient_validation_error(client):
    resp = client.post("/api/patient", json={})  # missing required fields
    assert resp.status_code == 422
