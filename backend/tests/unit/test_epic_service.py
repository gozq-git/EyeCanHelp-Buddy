import pytest

from models.patient import Patient
from services import epic_service

pytestmark = pytest.mark.unit


class _FakeResult:
    def __init__(self, patient):
        self._patient = patient

    def scalar_one_or_none(self):
        return self._patient


class _FakeSession:
    def __init__(self, patient):
        self._patient = patient

    async def execute(self, _stmt):
        return _FakeResult(self._patient)


class _FakeSessionCtx:
    def __init__(self, patient):
        self._patient = patient

    async def __aenter__(self):
        return _FakeSession(self._patient)

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeCollection:
    def __init__(self, doc):
        self._doc = doc

    async def find_one(self, _query):
        return self._doc


@pytest.mark.asyncio
async def test_get_patient_from_epic_returns_schema(monkeypatch):
    patient = Patient(
        patient_id="P001",
        patient_name="Tan Ah Kow",
        patient_dob="1952-08-12",
        phone_number="+6591234567",
    )
    monkeypatch.setattr(epic_service, "AsyncSessionLocal", lambda: _FakeSessionCtx(patient))

    result = await epic_service.get_patient_from_epic("P001")

    assert result is not None
    assert result.patient_id == "P001"
    assert result.patient_name == "Tan Ah Kow"


@pytest.mark.asyncio
async def test_get_patient_from_epic_not_found(monkeypatch):
    monkeypatch.setattr(epic_service, "AsyncSessionLocal", lambda: _FakeSessionCtx(None))

    result = await epic_service.get_patient_from_epic("UNKNOWN")

    assert result is None


@pytest.mark.asyncio
async def test_get_patient_record_from_epic_returns_schema(monkeypatch):
    fake_doc = {
        "_id": "mongo-id",
        "record_id": "REC-P001-001",
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
    }
    fake_db = {"TBL_PATIENT_RECORDS": _FakeCollection(fake_doc)}
    monkeypatch.setattr(epic_service, "get_mongo_db", lambda: fake_db)

    result = await epic_service.get_patient_record_from_epic("P001")

    assert result is not None
    assert result.record_id == "REC-P001-001"
    assert result.patient_id == "P001"


@pytest.mark.asyncio
async def test_get_patient_record_from_epic_not_found(monkeypatch):
    fake_db = {"TBL_PATIENT_RECORDS": _FakeCollection(None)}
    monkeypatch.setattr(epic_service, "get_mongo_db", lambda: fake_db)

    result = await epic_service.get_patient_record_from_epic("UNKNOWN")

    assert result is None
