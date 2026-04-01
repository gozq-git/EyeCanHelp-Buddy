# UC1: Mocked EPIC patient record lookup
# In production, this would call the hospital EPIC FHIR R4 API
from schemas.patient import PatientSchema
from schemas.patient_record import PatientRecordResponse
from datetime import datetime

MOCK_PATIENTS: dict[str, dict] = {
    "P001": {
        "patient_id": "P001",
        "patient_name": "Tan Ah Kow",
        "patient_dob": "1952-08-12",
        "phone_number": "+6591234567",
    },
    "P002": {
        "patient_id": "P002",
        "patient_name": "Lim Siew Eng",
        "patient_dob": "1965-03-25",
        "phone_number": "+6598765432",
    },
}

MOCK_RECORDS: dict[str, dict] = {
    "P001": {
        "record_id": "REC-P001-001",
        "patient_id": "P001",
        "record_name": "Tan Ah Kow",
        "record_diagnosis": "H35.31",          # AMD (Age-related Macular Degeneration)
        "record_eyes": "OD",
        "record_number_of_injections": 3,
        "record_validity_of_consent": True,
        "record_last3mths_admission": False,
        "record_stroke_heartAtt_last6mths": False,
        "record_taking_antibiotics": False,
        "record_pregnant": False,
        "issued": datetime.utcnow(),
    },
    "P002": {
        "record_id": "REC-P002-001",
        "patient_id": "P002",
        "record_name": "Lim Siew Eng",
        "record_diagnosis": "H36.0",           # DME (Diabetic Macular Edema)
        "record_eyes": "OS",
        "record_number_of_injections": 1,
        "record_validity_of_consent": True,
        "record_last3mths_admission": False,
        "record_stroke_heartAtt_last6mths": False,
        "record_taking_antibiotics": True,
        "record_pregnant": False,
        "issued": datetime.utcnow(),
    },
}


def get_patient_from_epic(patient_id: str) -> PatientSchema | None:
    data = MOCK_PATIENTS.get(patient_id)
    if data is None:
        return None
    return PatientSchema(**data)


def get_patient_record_from_epic(patient_id: str) -> PatientRecordResponse | None:
    data = MOCK_RECORDS.get(patient_id)
    if data is None:
        return None
    return PatientRecordResponse(**data)
