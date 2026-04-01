# UC2: Patient acknowledgement — identity, medical history, payment
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from motor.motor_asyncio import AsyncIOMotorDatabase
from database.postgres import get_db
from database.mongo import get_mongo_db
from schemas.patient_record import PatientRecordCreate, PatientRecordResponse
from schemas.payment import PaymentSchema
from services.acknowledgement_service import save_patient_acknowledgement, save_payment

router = APIRouter(prefix="/acknowledgement", tags=["Acknowledgement"])


class AcknowledgementRequest(BaseModel):
    patient_record: PatientRecordCreate
    payment: PaymentSchema


class AcknowledgementResponse(BaseModel):
    record: PatientRecordResponse
    payment: PaymentSchema
    message: str


@router.post("", response_model=AcknowledgementResponse)
async def submit_acknowledgement(
    request: AcknowledgementRequest,
    db: AsyncSession = Depends(get_db),
):
    mongo_db = get_mongo_db()

    record = await save_patient_acknowledgement(request.patient_record, mongo_db)
    payment = await save_payment(request.payment, db)

    return AcknowledgementResponse(
        record=record,
        payment=payment,
        message="Patient acknowledgement recorded successfully.",
    )
