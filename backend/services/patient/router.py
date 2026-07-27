from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database.postgres import get_db
from .schema import PatientCreate, PatientRecordResponse, PatientSchema
from .service import (
    create_patient,
    get_patient_by_id,
    get_patient_from_epic,
    get_patient_record_from_epic,
)

epic_router = APIRouter(prefix="/epic", tags=["EPIC"])
patient_router = APIRouter(prefix="/patient", tags=["Patient"])


@epic_router.get("/patient/{patient_id}", response_model=PatientSchema)
async def get_epic_patient(patient_id: str):
    patient = await get_patient_from_epic(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found in EPIC")
    return patient


@epic_router.get("/patient/{patient_id}/record", response_model=PatientRecordResponse)
async def get_epic_patient_record(patient_id: str):
    record = await get_patient_record_from_epic(patient_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"No EPIC record found for patient {patient_id}")
    return record


@patient_router.get("/{patient_id}")
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db)):
    patient = await get_patient_by_id(patient_id, db)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "patient_id": patient.patient_id,
        "patient_name": patient.patient_name,
        "patient_dob": patient.patient_dob,
        "gender": patient.gender,
        "phone_number": patient.phone_number,
        "email": patient.email,
        "status": patient.status,
    }


@patient_router.post("")
async def create_patient_record(data: PatientCreate, db: AsyncSession = Depends(get_db)):
    patient = await create_patient(data, db)
    return {
        "patient_id": patient.patient_id,
        "patient_name": patient.patient_name,
        "patient_dob": patient.patient_dob,
        "gender": patient.gender,
        "phone_number": patient.phone_number,
        "email": patient.email,
        "status": patient.status,
    }
