from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database.postgres import Base

CHATBOT_SCHEMA = "chatbot"


def _sgt_now_naive() -> datetime:
	# Store Singapore wall-clock time in a TIMESTAMP column.
	sgt = timezone(timedelta(hours=8))
	return datetime.now(sgt).replace(tzinfo=None)


class ChatExchangeLog(Base):
	__tablename__ = "TBL_CHAT_EXCHANGE_LOG"
	__table_args__ = {"schema": CHATBOT_SCHEMA}

	id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
	session_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
	mode: Mapped[str] = mapped_column(String(50), nullable=False)
	user_message: Mapped[str] = mapped_column(Text, nullable=False)
	system_response: Mapped[str] = mapped_column(Text, nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=_sgt_now_naive, nullable=False)


__all__ = ["ChatExchangeLog"]
