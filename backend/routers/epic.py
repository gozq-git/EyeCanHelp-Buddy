# UC1: Mocked EPIC patient record lookup
from fastapi import APIRouter, HTTPException
from schemas.patient import PatientSchema
from schemas.patient_record import PatientRecordResponse
from services.epic_service import get_patient_from_epic, get_patient_record_from_epic

router = APIRouter(prefix="/epic", tags=["EPIC"])


@router.get("/patient/{patient_id}", response_model=PatientSchema)
def get_patient(patient_id: str):
    patient = get_patient_from_epic(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found in EPIC")
    return patient


@router.get("/patient/{patient_id}/record", response_model=PatientRecordResponse)
def get_patient_record(patient_id: str):
    record = get_patient_record_from_epic(patient_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"No EPIC record found for patient {patient_id}")
    return record
