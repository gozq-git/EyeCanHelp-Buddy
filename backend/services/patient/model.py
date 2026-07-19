from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from database.postgres import Base


class Patient(Base):
	__tablename__ = "TBL_PATIENT"

	patient_id: Mapped[str] = mapped_column(String(50), primary_key=True)
	patient_name: Mapped[str] = mapped_column(String(255), nullable=False)
	patient_dob: Mapped[str] = mapped_column(String(20), nullable=False)
	phone_number: Mapped[str] = mapped_column(String(20), nullable=True)


class IVT(Base):
	__tablename__ = "TBL_IVT"

	ivt_id: Mapped[str] = mapped_column(String(50), primary_key=True)
	ivt_name: Mapped[str] = mapped_column(String(255), nullable=False)
	ivt_eyes: Mapped[str] = mapped_column(String(10), nullable=False)
	ivt_medication: Mapped[str] = mapped_column(String(255), nullable=False)

__all__ = ["Patient", "IVT"]
