import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "eyecanhelpbuddy")

_client: AsyncIOMotorClient | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URL, directConnection=True)
    return _client


def get_mongo_db():
    return get_mongo_client()[MONGO_DB]


def close_mongo_client():
    global _client
    if _client is not None:
        _client.close()
        _client = None


# Canonical seed records for the POC. Issued date is intentionally historical so any
# real user submission (now or in the future) is newer and wins the "latest" sort.
_SEED_RECORDS = [
    {
        "record_id": "REC-P001-001",
        "patient_id": "P001",
        "record_name": "Tan Ah Kow",
        "record_diagnosis": "H35.31",
        "record_eyes": "OD",
        "record_medication": "Faricimab (Vabysmo)",
        "record_number_of_injections": 3,
        "record_validity_of_consent": True,
        "record_last3mths_admission": False,
        "record_stroke_heartAtt_last6mths": False,
        "record_taking_antibiotics": False,
        "record_pregnant": False,
        "issued": datetime(2020, 1, 1),
    },
    {
        "record_id": "REC-P002-001",
        "patient_id": "P002",
        "record_name": "Lim Siew Eng",
        "record_diagnosis": "H36.0",
        "record_eyes": "OS",
        "record_medication": "Aflibercept (Eylea)",
        "record_number_of_injections": 1,
        "record_validity_of_consent": True,
        "record_last3mths_admission": False,
        "record_stroke_heartAtt_last6mths": False,
        "record_taking_antibiotics": True,
        "record_pregnant": False,
        "issued": datetime(2020, 1, 1),
    },
]


async def init_mongo() -> None:
    """Seed TBL_PATIENT_RECORDS with canonical P001/P002 records.

    Idempotent: uses upsert keyed by record_id with $setOnInsert, so re-runs on a
    populated DB leave existing docs untouched.
    """
    coll = get_mongo_db()["TBL_PATIENT_RECORDS"]
    for record in _SEED_RECORDS:
        await coll.update_one(
            {"record_id": record["record_id"]},
            {"$setOnInsert": record},
            upsert=True,
        )
