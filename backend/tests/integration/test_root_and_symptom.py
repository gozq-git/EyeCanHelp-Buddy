"""Integration tests for the root health check and UC3 symptom endpoint.

These routes touch neither the database nor AgentCore, so they exercise the
real service code end-to-end through the FastAPI stack.
"""
import pytest

pytestmark = pytest.mark.integration


def test_root_health_check(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"message": "EyeCanHelp Buddy API is running"}


def test_symptoms_severe(client):
    resp = client.post(
        "/api/symptoms",
        json={"patient_id": "P001", "symptom_description": "sudden vision loss and floaters"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["patient_id"] == "P001"
    assert body["severity"] == "severe"
    assert body["advice"]


def test_symptoms_mild(client):
    resp = client.post(
        "/api/symptoms",
        json={"patient_id": "P002", "symptom_description": "just mild discomfort and watery eyes"},
    )
    assert resp.status_code == 200
    assert resp.json()["severity"] == "mild"


def test_symptoms_unclear(client):
    resp = client.post(
        "/api/symptoms",
        json={"patient_id": "P003", "symptom_description": "I feel completely fine"},
    )
    assert resp.status_code == 200
    assert resp.json()["severity"] == "unclear"


def test_symptoms_validation_error_when_field_missing(client):
    resp = client.post("/api/symptoms", json={"patient_id": "P001"})
    assert resp.status_code == 422
