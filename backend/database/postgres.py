# isort: skip_file
import datetime
import os
import logging

from sqlalchemy import text
from sqlalchemy.ext import asyncio as sa_asyncio
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv("POSTGRES_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/eyecanhelpbuddy")

logger = logging.getLogger(__name__)

engine = sa_asyncio.create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sa_asyncio.async_sessionmaker(
    engine,
    class_=sa_asyncio.AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    # Ensure all SQLAlchemy models are registered even when init_db() is called directly.
    from services.billing import model as _billing_model  # noqa: F401
    from services.chatbot import model as _chatbot_model  # noqa: F401
    from services.patient import model as _patient_model  # noqa: F401

    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS patient"))
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS chatbot"))
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS billing"))
        await conn.run_sync(Base.metadata.create_all)
        if getattr(getattr(conn, "dialect", None), "name", "") == "postgresql":
            # create_all will not add columns to pre-existing tables.
            await conn.execute(text(
                'ALTER TABLE chatbot."TBL_CHAT_EXCHANGE_LOG" '
                "ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50)"
            ))
    await _seed_db()


async def _seed_db():
    from services.patient.model import IVT, Patient
    from sqlalchemy.dialects.postgresql import insert

    patients = [
        {
            "patient_id": "a25d9f8b-76b8-4f2a-8e2c-43fd5eb15a6c",
            "patient_name": "Tan Ah Kow",
            "patient_dob": datetime.date(1952, 8, 12),
            "gender": "male",
            "phone_number": "+6591234567",
            "email": "tan.ah.kow@example.com",
            "status": "active",
        },
        {
            "patient_id": "4db15be7-a9f5-4bf1-a7bc-938d0f838dbc",
            "patient_name": "Lim Siew Eng",
            "patient_dob": datetime.date(1965, 3, 25),
            "gender": "female",
            "phone_number": "+6598765432",
            "email": "lim.siew.eng@example.com",
            "status": "active",
        },
    ]
    ivts = [
        {
            "ivt_id": "02b49d88-6e7d-4470-95ea-839f552f6491",
            "ivt_name": "Intravitreal Faricimab",
            "ivt_medication": "Faricimab (Vabysmo)",
            "dosage": "6 mg/0.05 mL",
            "manufacturer": "Roche",
            "is_active": True,
        },
        {
            "ivt_id": "08d173bf-a33f-4510-a940-aaf28b994de0",
            "ivt_name": "Intravitreal Ranibizumab",
            "ivt_medication": "Ranibizumab (Lucentis)",
            "dosage": "0.5 mg/0.05 mL",
            "manufacturer": "Novartis",
            "is_active": True,
        },
        {
            "ivt_id": "3503fab4-c03c-4f68-a0af-9fcd5914ec9f",
            "ivt_name": "Intravitreal Aflibercept",
            "ivt_medication": "Aflibercept (Eylea)",
            "dosage": "2 mg/0.05 mL",
            "manufacturer": "Bayer",
            "is_active": True,
        },
    ]
    billing_prices = [
        ("SUB", "DOCTOR", 86.0, 310.0, 250.0),
        ("SUB", "NURSE", 62.0, 220.0, 250.0),
        ("PTE", "DOCTOR", 430.0, 480.0, 250.0),
        ("PTE", "NURSE", 300.0, 350.0, 250.0),
    ]

    async with AsyncSessionLocal() as session:
        try:
            async with session.begin():
                await session.execute(insert(Patient).values(patients).on_conflict_do_nothing(index_elements=["patient_id"]))
                await session.execute(insert(IVT).values(ivts).on_conflict_do_nothing(index_elements=["ivt_id"]))
        except Exception:
            logger.exception("Patient/IVT seed phase failed; continuing to billing seed phase")
            await session.rollback()

        async with session.begin():
            for record_class, performer, min_price, max_price, max_medisave in billing_prices:
                await session.execute(
                    text(
                        """
                        INSERT INTO billing."TBL_BILLING_PRICE"
                            (record_class, performer, min_per_injection, max_per_injection, max_medisave_claimable)
                        SELECT
                            CAST(:record_class AS VARCHAR(20)),
                            CAST(:performer AS VARCHAR(20)),
                            :min_per_injection,
                            :max_per_injection,
                            :max_medisave_claimable
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM billing."TBL_BILLING_PRICE"
                            WHERE UPPER(record_class) = UPPER(CAST(:record_class_cmp AS VARCHAR(20)))
                              AND UPPER(performer) = UPPER(CAST(:performer_cmp AS VARCHAR(20)))
                        )
                        """
                    ),
                    {
                        "record_class": record_class,
                        "performer": performer,
                        "record_class_cmp": record_class,
                        "performer_cmp": performer,
                        "min_per_injection": min_price,
                        "max_per_injection": max_price,
                        "max_medisave_claimable": max_medisave,
                    },
                )

        count_result = await session.execute(text('SELECT COUNT(*) FROM billing."TBL_BILLING_PRICE"'))
        count = int(count_result.scalar_one())
        logger.info("Billing seed complete: billing.TBL_BILLING_PRICE row count=%s", count)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
