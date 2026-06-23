"""Shared pytest fixtures for the EyeCanHelp Buddy backend test suite.

Design goals
------------
* No external services. PostgreSQL is replaced by an in-memory SQLite engine
  (aiosqlite); MongoDB by an in-process fake; the LLM/AgentCore call is mocked.
* The FastAPI lifespan normally tries to init Postgres + Mongo on startup. We
  patch those to no-ops so the TestClient starts instantly and offline.
"""
import sys
from pathlib import Path

# Ensure `backend/` is importable (main, routers, services, ...) regardless of
# pytest's rootdir/import-mode. tests/ lives directly under backend/.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession


# ──────────────────────────────────────────────────────────────────────────────
# In-memory SQLite engine standing in for PostgreSQL
# ──────────────────────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def sqlite_sessionmaker():
    """A fresh in-memory SQLite engine with all ORM tables created.

    A StaticPool keeps a single shared connection so the in-memory DB persists
    across sessions within one test.
    """
    from sqlalchemy.pool import StaticPool
    from database.postgres import Base
    # Importing main registers every model on Base.metadata.
    import main  # noqa: F401

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    yield maker
    await engine.dispose()


# ──────────────────────────────────────────────────────────────────────────────
# Fake MongoDB
# ──────────────────────────────────────────────────────────────────────────────
class FakeMongoCollection:
    """Minimal async stand-in for a Motor collection used by the app."""

    def __init__(self):
        self.docs: list[dict] = []

    async def insert_one(self, doc: dict):
        # Mirror Motor's behaviour of stamping an _id onto the inserted doc.
        doc.setdefault("_id", f"oid-{len(self.docs)}")
        self.docs.append(dict(doc))
        return type("InsertOneResult", (), {"inserted_id": doc["_id"]})()

    async def find_one(self, query: dict, sort=None):
        matches = [d for d in self.docs if all(d.get(k) == v for k, v in query.items())]
        if sort:
            for key, direction in reversed(sort):
                matches.sort(key=lambda d: d.get(key), reverse=direction < 0)
        return dict(matches[0]) if matches else None

    async def update_one(self, query, update, upsert=False):
        existing = await self.find_one(query)
        if existing is None and upsert and "$setOnInsert" in update:
            await self.insert_one(dict(update["$setOnInsert"]))


class FakeMongoDB:
    def __init__(self):
        self._collections: dict[str, FakeMongoCollection] = {}

    def __getitem__(self, name: str) -> FakeMongoCollection:
        return self._collections.setdefault(name, FakeMongoCollection())


@pytest.fixture
def fake_mongo():
    return FakeMongoDB()


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI test client with all I/O dependencies overridden
# ──────────────────────────────────────────────────────────────────────────────
@pytest.fixture
def client(monkeypatch, sqlite_sessionmaker, fake_mongo):
    """A starlette TestClient with DB/Mongo init disabled and dependencies overridden."""
    from fastapi.testclient import TestClient
    import main
    from database.postgres import get_db

    async def _noop():
        return None

    # Lifespan would otherwise try (and slowly time out) on real DBs.
    monkeypatch.setattr(main, "init_db", _noop)
    monkeypatch.setattr(main, "init_mongo", _noop)

    async def override_get_db():
        async with sqlite_sessionmaker() as session:
            yield session

    main.app.dependency_overrides[get_db] = override_get_db

    # Routers/services that reach Mongo directly (not via Depends) get the fake.
    monkeypatch.setattr("database.mongo.get_mongo_db", lambda: fake_mongo)
    monkeypatch.setattr("routers.acknowledgement.get_mongo_db", lambda: fake_mongo)
    monkeypatch.setattr("services.epic_service.get_mongo_db", lambda: fake_mongo)

    with TestClient(main.app) as test_client:
        yield test_client

    main.app.dependency_overrides.clear()
