from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.postgres import get_db
from models.patient import Patient

router = APIRouter(prefix="/patient", tags=["Patient"])


class PatientCreate(BaseModel):
    patient_id: str
    patient_name: str
    patient_dob: str
    phone_number: str | None = None


@router.get("/{patient_id}")
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).where(Patient.patient_id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "patient_id": patient.patient_id,
        "patient_name": patient.patient_name,
        "patient_dob": patient.patient_dob,
        "phone_number": patient.phone_number,
    }


@router.post("")
async def create_patient(data: PatientCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Patient).where(Patient.patient_id == data.patient_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Patient already exists")
    patient = Patient(
        patient_id=data.patient_id,
        patient_name=data.patient_name,
        patient_dob=data.patient_dob,
        phone_number=data.phone_number,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return {
        "patient_id": patient.patient_id,
        "patient_name": patient.patient_name,
        "patient_dob": patient.patient_dob,
        "phone_number": patient.phone_number,
    }
