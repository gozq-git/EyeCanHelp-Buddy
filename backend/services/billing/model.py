import typing

from sqlalchemy import Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database.postgres import Base

BILLING_SCHEMA = "billing"


class BillingPrice(Base):
	__tablename__ = "TBL_BILLING_PRICE"
	__table_args__: typing.ClassVar[tuple[object, ...]] = (
		UniqueConstraint("record_class", "performer", name="uq_tbl_billing_price_class_performer"),
		{"schema": BILLING_SCHEMA},
	)

	price_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
	record_class: Mapped[str] = mapped_column(String(20), nullable=False)
	performer: Mapped[str] = mapped_column(String(20), nullable=False)
	min_per_injection: Mapped[float] = mapped_column(Float, nullable=False)
	max_per_injection: Mapped[float] = mapped_column(Float, nullable=False)
	max_medisave_claimable: Mapped[float] = mapped_column(Float, nullable=False, default=250.0)


__all__ = ["BillingPrice"]
