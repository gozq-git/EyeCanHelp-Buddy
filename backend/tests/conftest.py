"""Shared pytest fixtures for the EyeCanHelp Buddy backend test suite.

Design goals
------------
* No external services. PostgreSQL is replaced by an in-memory SQLite engine
  (synchronous sqlite3 with a thin async shim); MongoDB by an in-process fake;
  the LLM/AgentCore call is mocked.
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
from sqlalchemy import JSON, create_engine, text
from sqlalchemy.orm import Session, sessionmaker


# ──────────────────────────────────────────────────────────────────────────────
# In-memory SQLite engine standing in for PostgreSQL
# ──────────────────────────────────────────────────────────────────────────────
class _AsyncSessionShim:
    """Expose a synchronous Session through the AsyncSession API surface that
    app code and tests use (add / execute / commit / refresh / async context
    manager).

    This replaces aiosqlite. aiosqlite runs every query on a worker thread,
    and on Windows that thread repeatedly crashes with `Windows fatal
    exception: access violation` when the test event loop closes — stalling a
    15-test run for ~4-6 minutes. sqlite3 calls here are in-memory and
    microsecond-fast, so blocking the event loop is a non-issue.
    """

    def __init__(self, session: Session):
        self._session = session

    def add(self, instance) -> None:
        self._session.add(instance)

    async def execute(self, statement, *args, **kwargs):
        return self._session.execute(statement, *args, **kwargs)

    async def commit(self) -> None:
        self._session.commit()

    async def refresh(self, instance) -> None:
        self._session.refresh(instance)

    async def close(self) -> None:
        self._session.close()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        self._session.close()
        return False


class _AsyncSessionmakerShim:
    """Match the `async_sessionmaker` call pattern: `maker()` -> shim."""

    def __init__(self, sync_maker: sessionmaker):
        self._sync_maker = sync_maker

    def __call__(self) -> _AsyncSessionShim:
        return _AsyncSessionShim(self._sync_maker())


@pytest.fixture(scope="session")
def sqlite_engine():
    """One shared synchronous in-memory SQLite engine for the test session.

    A StaticPool keeps a single shared connection so the in-memory DB persists
    across every test. Being synchronous, it has no event-loop affinity and no
    aiosqlite worker threads, so it is safe to share session-wide.
    """
    from sqlalchemy.pool import StaticPool
    from database.postgres import Base
    # Importing main registers every model on Base.metadata.
    import main  # noqa: F401

    # SQLite cannot compile PostgreSQL-specific server defaults like
    # `gen_random_uuid()`. Remove these defaults for test-only in-memory DDL.
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if column.server_default is not None and "gen_random_uuid" in str(column.server_default.arg):
                column.server_default = None
            if column.type.__class__.__name__ == "JSONB":
                column.type = JSON()

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        # SQLite has no schemas; attach logical databases so schema-qualified
        # table names (patient/chatbot/billing) can still be created in tests.
        conn.execute(text("ATTACH DATABASE ':memory:' AS patient"))
        conn.execute(text("ATTACH DATABASE ':memory:' AS chatbot"))
        conn.execute(text("ATTACH DATABASE ':memory:' AS billing"))
        Base.metadata.create_all(conn)

    yield engine
    engine.dispose()


@pytest.fixture
def sqlite_sessionmaker(sqlite_engine):
    """An async-session-lookalike factory bound to the shared engine.

    The in-memory DB is shared across tests. Rows inserted by one test are
    visible to later tests, but every existing test queries by its own unique
    session_id (or asserts an empty table for a mode that never writes), so
    this isolation-by-key keeps them independent.
    """
    sync_maker = sessionmaker(sqlite_engine, class_=Session, expire_on_commit=False)
    return _AsyncSessionmakerShim(sync_maker)


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
    monkeypatch.setattr("services.chatbot.router.mongo_module.get_mongo_db", lambda: fake_mongo)
    monkeypatch.setattr("services.patient.service.get_mongo_db", lambda: fake_mongo)

    with TestClient(main.app) as test_client:
        yield test_client

    main.app.dependency_overrides.clear()
