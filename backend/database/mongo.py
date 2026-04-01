import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "eyecanhelpbuddy")

_client: AsyncIOMotorClient | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URL)
    return _client


def get_mongo_db():
    return get_mongo_client()[MONGO_DB]


def close_mongo_client():
    global _client
    if _client is not None:
        _client.close()
        _client = None
