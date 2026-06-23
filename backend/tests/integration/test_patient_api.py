"""Integration tests for the patient CRUD endpoints backed by SQLAlchemy.

The `client` fixture overrides get_db with an in-memory SQLite session, so these
exercise the real ORM round-trip (insert + select) without PostgreSQL.
"""
import pytest

pytestmark = pytest.mark.integration

NEW_PATIENT = {
    "patient_id": "P999",
    "patient_name": "New Patient",
    "patient_dob": "1970-01-01",
    "phone_number": "+6580000000",
}


def test_create_then_get_patient(client):
    create = client.post("/api/patient", json=NEW_PATIENT)
    assert create.status_code == 200
    assert create.json()["patient_id"] == "P999"

    fetched = client.get("/api/patient/P999")
    assert fetched.status_code == 200
    assert fetched.json()["patient_name"] == "New Patient"


def test_create_duplicate_patient_conflicts(client):
    assert client.post("/api/patient", json=NEW_PATIENT).status_code == 200
    dup = client.post("/api/patient", json=NEW_PATIENT)
    assert dup.status_code == 409
    assert "already exists" in dup.json()["detail"].lower()


def test_get_unknown_patient_returns_404(client):
    resp = client.get("/api/patient/DOES-NOT-EXIST")
    assert resp.status_code == 404


def test_create_patient_validation_error(client):
    resp = client.post("/api/patient", json={"patient_id": "P1"})  # missing required fields
    assert resp.status_code == 422
