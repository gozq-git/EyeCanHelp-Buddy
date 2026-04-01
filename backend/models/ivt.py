# FHIR R4 resource: MedicationRequest / Procedure
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from database.postgres import Base


class IVT(Base):
    __tablename__ = "TBL_IVT"

    ivt_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    ivt_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ivt_eyes: Mapped[str] = mapped_column(String(10), nullable=False)   # OD | OS | OU
    ivt_medication: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. Eylea, Lucentis
