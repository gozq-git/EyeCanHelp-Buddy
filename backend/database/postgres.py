import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv("POSTGRES_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/eyecanhelpbuddy")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_db()


async def _seed_db():
    from models.patient import Patient
    from models.ivt import IVT
    from models.payment import Payment
    from sqlalchemy.dialects.postgresql import insert

    patients = [
        {"patient_id": "P001", "patient_name": "Tan Ah Kow",   "patient_dob": "1952-08-12", "phone_number": "+6591234567"},
        {"patient_id": "P002", "patient_name": "Lim Siew Eng", "patient_dob": "1965-03-25", "phone_number": "+6598765432"},
    ]
    ivts = [
        {"ivt_id": "IVT001", "ivt_name": "Intravitreal Faricimab", "ivt_eyes": "OD", "ivt_medication": "Faricimab (Vabysmo)"},
        {"ivt_id": "IVT002", "ivt_name": "Intravitreal Ranibizumab", "ivt_eyes": "OS", "ivt_medication": "Ranibizumab (Lucentis)"},
        {"ivt_id": "IVT003", "ivt_name": "Intravitreal Aflibercept", "ivt_eyes": "OU", "ivt_medication": "Aflibercept (Eylea)"},
    ]
    payments = [
        {"payment_id": "PAY001", "payment_name": "Medisave Standard",  "payment_diagnosis": "H35.31", "payment_maxMedisave": 2150.0, "payment_estCostPerInjection": 123.0, "payment_mode": "Medisave"},
        {"payment_id": "PAY002", "payment_name": "Cash Payment",        "payment_diagnosis": "H36.0",  "payment_maxMedisave": 0.0,    "payment_estCostPerInjection": 500.0, "payment_mode": "Cash"},
        {"payment_id": "PAY003", "payment_name": "MediShield Life",     "payment_diagnosis": "H34.8",  "payment_maxMedisave": 2150.0, "payment_estCostPerInjection": 200.0, "payment_mode": "MediShield"},
        {"payment_id": "PAY004", "payment_name": "CHAS Subsidised",     "payment_diagnosis": "H35.31", "payment_maxMedisave": 2150.0, "payment_estCostPerInjection": 50.0,  "payment_mode": "CHAS"},
    ]

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(insert(Patient).values(patients).on_conflict_do_nothing(index_elements=["patient_id"]))
            await session.execute(insert(IVT).values(ivts).on_conflict_do_nothing(index_elements=["ivt_id"]))
            await session.execute(insert(Payment).values(payments).on_conflict_do_nothing(index_elements=["payment_id"]))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
