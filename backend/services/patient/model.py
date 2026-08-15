# isort: skip_file
import datetime
import typing
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.postgres import Base

PATIENT_SCHEMA = "patient"
GEN_RANDOM_UUID_SQL = "gen_random_uuid()"


class Patient(Base):
	__tablename__ = "TBL_PATIENT"
	__table_args__: typing.ClassVar[dict[str, str]] = {"schema": PATIENT_SCHEMA}

	patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	patient_name: Mapped[str] = mapped_column(String(150), nullable=False)
	patient_dob: Mapped[datetime.date] = mapped_column(Date, nullable=False)
	gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
	phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
	email: Mapped[str | None] = mapped_column(String(150), nullable=True)
	status: Mapped[str | None] = mapped_column(String(30), nullable=True)
	created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)
	updated_at: Mapped[datetime.datetime] = mapped_column(
		DateTime,
		server_default=func.current_timestamp(),
		onupdate=func.current_timestamp(),
		nullable=False,
	)


class IVT(Base):
	__tablename__ = "TBL_IVT"
	__table_args__: typing.ClassVar[dict[str, str]] = {"schema": PATIENT_SCHEMA}

	ivt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	ivt_name: Mapped[str] = mapped_column(String(150), nullable=False)
	ivt_medication: Mapped[str | None] = mapped_column(String(150), nullable=True)
	dosage: Mapped[str | None] = mapped_column(String(100), nullable=True)
	manufacturer: Mapped[str | None] = mapped_column(String(150), nullable=True)
	is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Diagnosis(Base):
	__tablename__ = "TBL_DIAGNOSIS"
	__table_args__: typing.ClassVar[dict[str, str]] = {"schema": PATIENT_SCHEMA}

	diagnosis_code: Mapped[str] = mapped_column(String(50), primary_key=True)
	diagnosis_name: Mapped[str] = mapped_column(String(150), nullable=False)
	diagnosis_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
	description: Mapped[str | None] = mapped_column(Text, nullable=True)
	is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PatientDiagnosis(Base):
	__tablename__ = "TBL_PATIENT_DIAGNOSIS"
	__table_args__: typing.ClassVar[dict[str, str]] = {"schema": PATIENT_SCHEMA}

	patient_diagnosis_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
		server_default=text(GEN_RANDOM_UUID_SQL),
	)
	patient_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_PATIENT.patient_id", ondelete="CASCADE"),
		nullable=False,
	)
	diagnosis_code: Mapped[str] = mapped_column(
		String(50),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_DIAGNOSIS.diagnosis_code", onupdate="CASCADE", ondelete="RESTRICT"),
		nullable=False,
	)
	diagnosis_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
	eye_affected: Mapped[str | None] = mapped_column(String(20), nullable=True)
	severity: Mapped[str | None] = mapped_column(String(50), nullable=True)
	status: Mapped[str | None] = mapped_column(String(30), nullable=True)
	created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)


class PatientIVT(Base):
	__tablename__ = "TBL_PATIENT_IVT"
	__table_args__ = (
		CheckConstraint("injection_count IS NULL OR injection_count >= 0", name="chk_tbl_patient_ivt_injection_count"),
		{"schema": PATIENT_SCHEMA},
	)

	patient_ivt_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
		server_default=text(GEN_RANDOM_UUID_SQL),
	)
	patient_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_PATIENT.patient_id", ondelete="CASCADE"),
		nullable=False,
	)
	ivt_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_IVT.ivt_id", ondelete="RESTRICT"),
		nullable=False,
	)
	patient_diagnosis_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_PATIENT_DIAGNOSIS.patient_diagnosis_id", ondelete="RESTRICT"),
		nullable=False,
	)
	start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
	injection_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
	status: Mapped[str | None] = mapped_column(String(30), nullable=True)
	created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)


class InjectionSession(Base):
	__tablename__ = "TBL_INJECTION_SESSION"
	__table_args__: typing.ClassVar[dict[str, str]] = {"schema": PATIENT_SCHEMA}

	session_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
		server_default=text(GEN_RANDOM_UUID_SQL),
	)
	patient_ivt_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_PATIENT_IVT.patient_ivt_id", ondelete="CASCADE"),
		nullable=False,
	)
	patient_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_PATIENT.patient_id", ondelete="CASCADE"),
		nullable=False,
	)
	session_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
	eye_treated: Mapped[str | None] = mapped_column(String(20), nullable=True)
	batch_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
	clinical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
	session_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
	created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)


class FormRecord(Base):
	__tablename__ = "TBL_FORM_RECORD"
	__table_args__: typing.ClassVar[dict[str, str]] = {"schema": PATIENT_SCHEMA}

	form_record_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
		server_default=text(GEN_RANDOM_UUID_SQL),
	)
	patient_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_PATIENT.patient_id", ondelete="CASCADE"),
		nullable=False,
	)
	form_type: Mapped[str] = mapped_column(String(100), nullable=False)
	form_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
	form_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
	submitted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
	created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)


class PatientAddress(Base):
	__tablename__ = "TBL_PATIENT_ADDRESS"
	__table_args__ = (
		Index("uq_tbl_patient_address_one_primary", "patient_id", unique=True, postgresql_where=text("is_primary = TRUE")),
		{"schema": PATIENT_SCHEMA},
	)

	address_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
		server_default=text(GEN_RANDOM_UUID_SQL),
	)
	patient_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey(f"{PATIENT_SCHEMA}.TBL_PATIENT.patient_id", ondelete="CASCADE"),
		nullable=False,
	)
	address_line: Mapped[str] = mapped_column(Text, nullable=False)
	postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
	is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
	created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)


Index("idx_tbl_patient_diagnosis_patient_id", PatientDiagnosis.patient_id)
Index("idx_tbl_patient_diagnosis_code", PatientDiagnosis.diagnosis_code)
Index("idx_tbl_patient_ivt_patient_id", PatientIVT.patient_id)
Index("idx_tbl_patient_ivt_ivt_id", PatientIVT.ivt_id)
Index("idx_tbl_patient_ivt_patient_diagnosis_id", PatientIVT.patient_diagnosis_id)
Index("idx_tbl_injection_session_patient_ivt_id", InjectionSession.patient_ivt_id)
Index("idx_tbl_injection_session_patient_id", InjectionSession.patient_id)
Index("idx_tbl_injection_session_session_date", InjectionSession.session_date)
Index("idx_tbl_form_record_patient_id", FormRecord.patient_id)
Index("idx_tbl_patient_address_patient_id", PatientAddress.patient_id)

