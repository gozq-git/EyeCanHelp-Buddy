# FHIR R4 resource: Coverage / Claim
from sqlalchemy import String, Float
from sqlalchemy.orm import Mapped, mapped_column
from database.postgres import Base


class Payment(Base):
    __tablename__ = "TBL_PAYMENT"

    payment_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    payment_name: Mapped[str] = mapped_column(String(255), nullable=False)
    payment_diagnosis: Mapped[str] = mapped_column(String(50), nullable=False)   # ICD-10 code
    payment_maxMedisave: Mapped[float] = mapped_column(Float, nullable=False)
    payment_estCostPerInjection: Mapped[float] = mapped_column(Float, nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(50), nullable=False)  # Medisave | Cash | MediShield
