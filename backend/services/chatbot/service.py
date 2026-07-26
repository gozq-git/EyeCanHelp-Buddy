import uuid
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from .model import ChatExchangeLog, Payment
from .schema import PatientRecordCreate, PatientRecordResponse, PaymentSchema
from .llm import chat, chat_stream


async def save_patient_acknowledgement(
	data: PatientRecordCreate,
	mongo_db: AsyncIOMotorDatabase,
) -> PatientRecordResponse:
	record_id = f"REC-{data.patient_id}-{uuid.uuid4().hex[:6].upper()}"
	issued = datetime.utcnow()
	doc = {
		"record_id": record_id,
		"issued": issued,
		**data.model_dump(),
	}
	await mongo_db["TBL_PATIENT_RECORDS"].insert_one(doc)
	return PatientRecordResponse(record_id=record_id, issued=issued, **data.model_dump())


async def save_payment(
	payment_data: PaymentSchema,
	db: AsyncSession,
) -> PaymentSchema:
	record = Payment(
		payment_id=payment_data.payment_id,
		payment_name=payment_data.payment_name,
		payment_diagnosis=payment_data.payment_diagnosis,
		payment_maxMedisave=payment_data.payment_maxMedisave,
		payment_estCostPerInjection=payment_data.payment_estCostPerInjection,
		payment_mode=payment_data.payment_mode,
	)
	db.add(record)
	await db.commit()
	await db.refresh(record)
	return PaymentSchema.model_validate(record)


async def save_chat_exchange(
	session_id: str,
	mode: str,
	user_message: str,
	system_response: str,
	db: AsyncSession,
) -> ChatExchangeLog:
	record = ChatExchangeLog(
		session_id=session_id,
		mode=mode,
		user_message=user_message,
		system_response=system_response,
	)
	db.add(record)
	await db.commit()
	await db.refresh(record)
	return record


__all__ = ["chat", "chat_stream", "save_patient_acknowledgement", "save_payment", "save_chat_exchange"]
