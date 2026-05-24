# UC1: EPIC patient + record lookup.
#
# Originally this was an in-memory dict that pretended to be EPIC. The POC now
# stores the same canonical records in PostgreSQL (TBL_PATIENT) and MongoDB
# (TBL_PATIENT_RECORDS), so this service reads from those two stores instead.
# In production these calls would be replaced by EPIC FHIR R4 API requests; the
# service boundary is preserved so routers and the frontend's EPIC fallback path
# do not need to change.
from sqlalchemy import select

from database.postgres import AsyncSessionLocal
from database.mongo import get_mongo_db
from models.patient import Patient
from schemas.patient import PatientSchema
from schemas.patient_record import PatientRecordResponse


async def get_patient_from_epic(patient_id: str) -> PatientSchema | None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Patient).where(Patient.patient_id == patient_id))
        patient = result.scalar_one_or_none()
    if patient is None:
        return None
    return PatientSchema(
        patient_id=patient.patient_id,
        patient_name=patient.patient_name,
        patient_dob=patient.patient_dob,
        phone_number=patient.phone_number,
    )


async def get_patient_record_from_epic(patient_id: str) -> PatientRecordResponse | None:
    # EPIC returns the canonical seed (record_id = "REC-{patient_id}-001"), NOT the
    # latest user acknowledgement. Patient-side submissions live in the same Mongo
    # collection but represent a different concept (consent + medical history each
    # visit) — those are reached via /acknowledgement/latest/{patient_id}.
    doc = await get_mongo_db()["TBL_PATIENT_RECORDS"].find_one(
        {"record_id": f"REC-{patient_id}-001"},
    )
    if doc is None:
        return None
    doc.pop("_id", None)
    return PatientRecordResponse(**doc)
