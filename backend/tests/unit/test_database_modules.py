import pytest

from database import mongo, postgres

pytestmark = pytest.mark.unit


class _FakeMotorClient:
    def __init__(self, _url):
        self._dbs = {}
        self.closed = False

    def __getitem__(self, name):
        self._dbs.setdefault(name, {})
        return self._dbs[name]

    def close(self):
        self.closed = True


class _FakeCollection:
    def __init__(self):
        self.rows = {}

    async def update_one(self, query, update, upsert=False):
        rid = query['record_id']
        if rid not in self.rows and upsert and '$setOnInsert' in update:
            self.rows[rid] = dict(update['$setOnInsert'])


class _FakeMongoDB:
    def __init__(self):
        self.collections = {'TBL_PATIENT_RECORDS': _FakeCollection()}

    def __getitem__(self, name):
        return self.collections[name]


class _FakeBeginCtx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeConn:
    def __init__(self):
        self.sync_calls = 0

    async def run_sync(self, _fn):
        self.sync_calls += 1


class _FakeEngine:
    def __init__(self):
        self.conn = _FakeConn()

    def begin(self):
        return _FakeBeginCtx(self.conn)


class _FakeAsyncSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


def test_get_mongo_client_is_cached(monkeypatch):
    mongo._client = None
    monkeypatch.setattr(mongo, 'AsyncIOMotorClient', _FakeMotorClient)

    first = mongo.get_mongo_client()
    second = mongo.get_mongo_client()

    assert first is second


def test_close_mongo_client_resets_client(monkeypatch):
    mongo._client = None
    monkeypatch.setattr(mongo, 'AsyncIOMotorClient', _FakeMotorClient)

    client = mongo.get_mongo_client()
    mongo.close_mongo_client()

    assert client.closed is True
    assert mongo._client is None


@pytest.mark.asyncio
async def test_init_mongo_upserts_seed_records(monkeypatch):
    fake_db = _FakeMongoDB()
    monkeypatch.setattr(mongo, 'get_mongo_db', lambda: fake_db)

    await mongo.init_mongo()

    records = fake_db['TBL_PATIENT_RECORDS'].rows
    assert 'REC-P001-001' in records
    assert 'REC-P002-001' in records


@pytest.mark.asyncio
async def test_init_db_runs_metadata_create_and_seed(monkeypatch):
    fake_engine = _FakeEngine()
    seeded = {'called': False}

    async def _fake_seed_db():
        seeded['called'] = True

    monkeypatch.setattr(postgres, 'engine', fake_engine)
    monkeypatch.setattr(postgres, '_seed_db', _fake_seed_db)

    await postgres.init_db()

    assert fake_engine.conn.sync_calls == 1
    assert seeded['called'] is True


@pytest.mark.asyncio
async def test_get_db_yields_session(monkeypatch):
    monkeypatch.setattr(postgres, 'AsyncSessionLocal', lambda: _FakeAsyncSession())

    gen = postgres.get_db()
    session = await anext(gen)

    assert isinstance(session, _FakeAsyncSession)

    with pytest.raises(StopAsyncIteration):
        await anext(gen)
