import pytest

from database import postgres

pytestmark = pytest.mark.unit


class _BeginCtx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeConn:
    def __init__(self):
        self.run_sync_calls = []

    async def run_sync(self, fn):
        self.run_sync_calls.append(fn)


class _FakeEngine:
    def __init__(self):
        self.conn = _FakeConn()

    def begin(self):
        return _BeginCtx(self.conn)


class _TxnCtx:
    async def __aenter__(self):
        return None

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeSession:
    def __init__(self, executed):
        self.executed = executed

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return _TxnCtx()

    async def execute(self, stmt):
        self.executed.append(stmt)


@pytest.mark.asyncio
async def test_init_db_runs_create_all_and_seed(monkeypatch):
    fake_engine = _FakeEngine()
    called = {"seed": False}

    async def _fake_seed():
        called["seed"] = True

    monkeypatch.setattr(postgres, "engine", fake_engine)
    monkeypatch.setattr(postgres, "_seed_db", _fake_seed)

    await postgres.init_db()

    assert len(fake_engine.conn.run_sync_calls) == 1
    assert called["seed"] is True


@pytest.mark.asyncio
async def test_seed_db_executes_three_upsert_statements(monkeypatch):
    executed = []

    monkeypatch.setattr(postgres, "AsyncSessionLocal", lambda: _FakeSession(executed))

    await postgres._seed_db()

    assert len(executed) == 3


@pytest.mark.asyncio
async def test_get_db_yields_session(monkeypatch):
    sentinel = object()

    class _SessionCtx:
        async def __aenter__(self):
            return sentinel

        async def __aexit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(postgres, "AsyncSessionLocal", lambda: _SessionCtx())

    sessions = []
    async for session in postgres.get_db():
        sessions.append(session)

    assert sessions == [sentinel]
