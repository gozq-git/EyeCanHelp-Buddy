# FHIR R4 resource: Patient
from sqlalchemy import String, Date
from sqlalchemy.orm import Mapped, mapped_column
from database.postgres import Base


class Patient(Base):
    __tablename__ = "TBL_PATIENT"

    patient_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    patient_dob: Mapped[str] = mapped_column(String(20), nullable=False)  # ISO date string
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True)
