"""Unit tests for the database bootstrap code in database/postgres.py and
database/mongo.py.

The real Postgres engine / Motor client are replaced with fakes so the init +
seed + session-factory code runs offline. These paths otherwise only execute on
app startup against live databases.
"""
import pytest

import database.postgres as pg
import database.mongo as mongo

pytestmark = pytest.mark.unit


# ─────────────────────────── database/postgres.py ──────────────────────────────
class _FakeConn:
    async def run_sync(self, fn):
        return None


class _FakeBegin:
    async def __aenter__(self):
        return _FakeConn()

    async def __aexit__(self, *args):
        return False


class _FakeEngine:
    def begin(self):
        return _FakeBegin()


class _FakeTxn:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class _FakeSession:
    def __init__(self):
        self.executed = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    def begin(self):
        return _FakeTxn()

    async def execute(self, statement):
        self.executed.append(statement)
        return None


async def test_init_db_creates_tables_and_seeds(monkeypatch):
    monkeypatch.setattr(pg, "engine", _FakeEngine())
    seeded = {}

    async def _fake_seed():
        seeded["called"] = True

    monkeypatch.setattr(pg, "_seed_db", _fake_seed)
    await pg.init_db()
    assert seeded["called"] is True


async def test_seed_db_inserts_all_seed_tables(monkeypatch):
    session = _FakeSession()
    monkeypatch.setattr(pg, "AsyncSessionLocal", lambda: session)
    await pg._seed_db()
    # One insert per seed table: patients and ivts.
    assert len(session.executed) == 2


async def test_get_db_yields_session(monkeypatch):
    sentinel = _FakeSession()
    monkeypatch.setattr(pg, "AsyncSessionLocal", lambda: sentinel)
    agen = pg.get_db()
    session = await agen.__anext__()
    assert session is sentinel
    await agen.aclose()


# ──────────────────────────── database/mongo.py ────────────────────────────────
class _FakeMongoCollection:
    def __init__(self):
        self.upserts = []

    async def update_one(self, query, update, upsert=False):
        self.upserts.append((query, update, upsert))


class _FakeMongoDatabase:
    def __init__(self):
        self.collection = _FakeMongoCollection()

    def __getitem__(self, name):
        return self.collection


class _FakeMotorClient:
    def __init__(self, url):
        self.url = url
        self.database = _FakeMongoDatabase()
        self.closed = False

    def __getitem__(self, name):
        return self.database

    def close(self):
        self.closed = True


@pytest.fixture
def fake_motor(monkeypatch):
    # Reset the module-level singleton and swap the Motor client for a fake.
    monkeypatch.setattr(mongo, "_client", None)
    monkeypatch.setattr(mongo, "AsyncIOMotorClient", _FakeMotorClient)
    yield


def test_get_mongo_client_is_cached(fake_motor):
    first = mongo.get_mongo_client()
    second = mongo.get_mongo_client()
    assert isinstance(first, _FakeMotorClient)
    assert first is second  # cached singleton


def test_get_mongo_db_returns_named_database(fake_motor):
    db = mongo.get_mongo_db()
    assert isinstance(db, _FakeMongoDatabase)


def test_close_mongo_client_resets_singleton(fake_motor):
    client = mongo.get_mongo_client()
    mongo.close_mongo_client()
    assert client.closed is True
    assert mongo._client is None


async def test_init_mongo_seeds_records(fake_motor):
    await mongo.init_mongo()
    collection = mongo.get_mongo_db()["TBL_PATIENT_RECORDS"]
    # One upsert per canonical seed record (P001, P002).
    assert len(collection.upserts) == len(mongo._SEED_RECORDS)
    assert all(up[2] is True for up in collection.upserts)  # upsert=True
