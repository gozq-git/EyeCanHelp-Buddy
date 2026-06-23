"""Unit tests for Pydantic schema validation / defaults."""
import pytest
from datetime import datetime
from pydantic import ValidationError

from schemas.patient import PatientSchema
from schemas.payment import PaymentSchema
from schemas.patient_record import PatientRecordCreate, PatientRecordResponse

pytestmark = pytest.mark.unit


def test_patient_schema_defaults_resource_type():
    p = PatientSchema(patient_id="P001", patient_name="Tan Ah Kow", patient_dob="1952-08-12")
    assert p.resourceType == "Patient"
    assert p.phone_number is None


def test_payment_schema_accepts_valid_mode():
    pay = PaymentSchema(
        payment_id="PAY001",
        payment_name="Medisave Standard",
        payment_diagnosis="H35.31",
        payment_maxMedisave=2150.0,
        payment_estCostPerInjection=123.0,
        payment_mode="Medisave",
    )
    assert pay.resourceType == "Coverage"
    assert pay.payment_mode == "Medisave"


def test_payment_schema_rejects_invalid_mode():
    with pytest.raises(ValidationError):
        PaymentSchema(
            payment_id="PAY001",
            payment_name="Bad Mode",
            payment_diagnosis="H35.31",
            payment_maxMedisave=0.0,
            payment_estCostPerInjection=1.0,
            payment_mode="Bitcoin",  # not in the allowed Literal set
        )


def _record_payload() -> dict:
    return dict(
        patient_id="P001",
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


def test_patient_record_create_valid():
    rec = PatientRecordCreate(**_record_payload())
    assert rec.record_eyes == "OD"
    assert rec.record_number_of_injections == 3


def test_patient_record_response_sets_defaults():
    rec = PatientRecordResponse(record_id="REC-P001-001", **_record_payload())
    assert rec.resourceType == "DiagnosticReport"
    assert isinstance(rec.issued, datetime)
    assert rec.record_medication is None


def test_patient_record_create_rejects_missing_field():
    payload = _record_payload()
    del payload["record_diagnosis"]
    with pytest.raises(ValidationError):
        PatientRecordCreate(**payload)
