import pytest

from database import mongo

pytestmark = pytest.mark.unit


class _FakeClient:
    def __init__(self, url):
        self.url = url
        self.closed = False
        self._dbs = {}

    def __getitem__(self, db_name):
        return self._dbs.setdefault(db_name, {})

    def close(self):
        self.closed = True


class _FakeCollection:
    def __init__(self):
        self.calls = []

    async def update_one(self, query, update, upsert=False):
        self.calls.append((query, update, upsert))


@pytest.fixture(autouse=True)
def _reset_client():
    mongo._client = None
    yield
    mongo._client = None


def test_get_mongo_client_caches_client(monkeypatch):
    monkeypatch.setattr(mongo, "AsyncIOMotorClient", _FakeClient)

    c1 = mongo.get_mongo_client()
    c2 = mongo.get_mongo_client()

    assert c1 is c2
    assert c1.url == mongo.MONGO_URL


def test_get_mongo_db_and_close_client(monkeypatch):
    monkeypatch.setattr(mongo, "AsyncIOMotorClient", _FakeClient)

    client = mongo.get_mongo_client()
    db = mongo.get_mongo_db()

    assert db is client[mongo.MONGO_DB]

    mongo.close_mongo_client()
    assert mongo._client is None
    assert client.closed is True


@pytest.mark.asyncio
async def test_init_mongo_upserts_seed_records(monkeypatch):
    fake_collection = _FakeCollection()
    fake_db = {"TBL_PATIENT_RECORDS": fake_collection}

    monkeypatch.setattr(mongo, "get_mongo_db", lambda: fake_db)

    await mongo.init_mongo()

    assert len(fake_collection.calls) == 2
    for query, update, upsert in fake_collection.calls:
        assert query["record_id"].startswith("REC-")
        assert "$setOnInsert" in update
        assert upsert is True
