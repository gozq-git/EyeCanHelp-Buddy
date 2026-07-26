from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database.postgres import Base


class Payment(Base):
	__tablename__ = "TBL_PAYMENT"

	payment_id: Mapped[str] = mapped_column(String(50), primary_key=True)
	payment_name: Mapped[str] = mapped_column(String(255), nullable=False)
	payment_diagnosis: Mapped[str] = mapped_column(String(50), nullable=False)
	payment_maxMedisave: Mapped[float] = mapped_column(Float, nullable=False)
	payment_estCostPerInjection: Mapped[float] = mapped_column(Float, nullable=False)
	payment_mode: Mapped[str] = mapped_column(String(50), nullable=False)


class ChatExchangeLog(Base):
	__tablename__ = "TBL_CHAT_EXCHANGE_LOG"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
	session_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
	mode: Mapped[str] = mapped_column(String(50), nullable=False)
	user_message: Mapped[str] = mapped_column(Text, nullable=False)
	system_response: Mapped[str] = mapped_column(Text, nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


__all__ = ["Payment", "ChatExchangeLog"]
