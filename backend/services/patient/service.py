from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.postgres import AsyncSessionLocal
from database.mongo import get_mongo_db
from .model import Patient
from .schema import PatientCreate, PatientRecordResponse, PatientSchema


async def get_patient_from_epic(
    patient_id: str,
    session_factory=None,
) -> PatientSchema | None:
    try:
        patient_uuid = UUID(patient_id)
    except ValueError:
        return None

    session_factory = session_factory or AsyncSessionLocal
    async with session_factory() as session:
        result = await session.execute(select(Patient).where(Patient.patient_id == patient_uuid))
        patient = result.scalar_one_or_none()
    if patient is None:
        return None
    return PatientSchema(
        patient_id=patient.patient_id,
        patient_name=patient.patient_name,
        patient_dob=patient.patient_dob,
        gender=patient.gender,
        phone_number=patient.phone_number,
        email=patient.email,
        status=patient.status,
    )


async def get_patient_record_from_epic(
    patient_id: str,
    mongo_getter=None,
) -> PatientRecordResponse | None:
    mongo_getter = mongo_getter or get_mongo_db
    doc = await mongo_getter()["TBL_PATIENT_RECORDS"].find_one(
        {"record_id": f"REC-{patient_id}-001"},
    )
    if doc is None:
        return None
    doc.pop("_id", None)
    return PatientRecordResponse(**doc)


async def get_patient_by_id(patient_id: str, db: AsyncSession) -> Patient | None:
    try:
        patient_uuid = UUID(patient_id)
    except ValueError:
        return None
    result = await db.execute(select(Patient).where(Patient.patient_id == patient_uuid))
    return result.scalar_one_or_none()


async def create_patient(data: PatientCreate, db: AsyncSession) -> Patient:
    patient = Patient(
        patient_name=data.patient_name,
        patient_dob=data.patient_dob,
        gender=data.gender,
        phone_number=data.phone_number,
        email=data.email,
        status=data.status,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return patient


__all__ = [
    "get_patient_from_epic",
    "get_patient_record_from_epic",
    "get_patient_by_id",
    "create_patient",
]
