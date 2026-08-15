"""Unit tests for the Bedrock knowledge-base tools (agents/coordinator/tools/kb_tools.py).

`boto3.client` is replaced by a fake bedrock-agent-runtime, so no AWS call is made.
"""
import sys
from pathlib import Path

import pytest
from botocore.exceptions import BotoCoreError, ClientError

COORDINATOR_DIR = Path(__file__).resolve().parents[2] / "agents" / "coordinator"
if str(COORDINATOR_DIR) not in sys.path:
    # Append so backend/main.py keeps precedence for `import main`.
    sys.path.append(str(COORDINATOR_DIR))

from tools import kb_tools

pytestmark = pytest.mark.unit


class _FakeAgentRuntime:
    def __init__(self, results=None, raises=None):
        self._results = results if results is not None else []
        self._raises = raises
        self.calls = []

    def retrieve(self, **kwargs):
        self.calls.append(kwargs)
        if self._raises:
            raise self._raises
        return {"retrievalResults": self._results}


@pytest.fixture
def fake_runtime(monkeypatch):
    def _install(**kwargs):
        client = _FakeAgentRuntime(**kwargs)
        monkeypatch.setattr(kb_tools.boto3, "client", lambda *a, **kw: client)
        return client

    return _install


def _hit(text, score=0.9):
    return {"content": {"text": text}, "score": score}


# ── _retrieve_kb ──────────────────────────────────────────────────────────────
@pytest.mark.parametrize("query", ["", "   ", None])
def test_retrieve_kb_rejects_empty_query(query):
    out = kb_tools._retrieve_kb(query, kb_id="kb-1", region="us-east-1")

    assert out == [{"error": "Query must not be empty."}]


@pytest.mark.parametrize("kb_id", ["", "   ", None])
def test_retrieve_kb_rejects_missing_kb_id(kb_id):
    out = kb_tools._retrieve_kb("glaucoma", kb_id=kb_id, region="us-east-1")

    assert out == [{"error": "Knowledge base ID is not configured."}]


def test_retrieve_kb_ranks_results(fake_runtime):
    fake_runtime(results=[_hit("first", 0.9), _hit("second", 0.7)])

    out = kb_tools._retrieve_kb("glaucoma", kb_id="kb-1", region="us-east-1")

    assert out == [
        {"rank": 1, "content": "first", "score": 0.9},
        {"rank": 2, "content": "second", "score": 0.7},
    ]


def test_retrieve_kb_defaults_missing_fields(fake_runtime):
    fake_runtime(results=[{}])

    out = kb_tools._retrieve_kb("glaucoma", kb_id="kb-1", region=None)

    assert out == [{"rank": 1, "content": "", "score": 0.0}]


@pytest.mark.parametrize(
    "requested,expected",
    [(0, 1), (1, 1), (5, 5), (10, 10), (99, 10)],
)
def test_retrieve_kb_clamps_max_results(fake_runtime, requested, expected):
    client = fake_runtime(results=[])

    kb_tools._retrieve_kb("glaucoma", kb_id="kb-1", region=None, max_results=requested)

    config = client.calls[0]["retrievalConfiguration"]["vectorSearchConfiguration"]
    assert config["numberOfResults"] == expected


def test_retrieve_kb_passes_query_and_kb_id(fake_runtime):
    client = fake_runtime(results=[])

    kb_tools._retrieve_kb("  glaucoma  ", kb_id="  kb-42  ", region=None)

    assert client.calls[0]["knowledgeBaseId"] == "kb-42"
    assert client.calls[0]["retrievalQuery"] == {"text": "glaucoma"}


def test_retrieve_kb_wraps_aws_client_error(fake_runtime):
    error = ClientError({"Error": {"Code": "AccessDenied", "Message": "nope"}}, "Retrieve")
    fake_runtime(raises=error)

    out = kb_tools._retrieve_kb("glaucoma", kb_id="kb-1", region=None)

    assert "error" in out[0]
    assert "Failed to search knowledge base" in out[0]["error"]


def test_retrieve_kb_wraps_botocore_error(fake_runtime):
    fake_runtime(raises=BotoCoreError())

    out = kb_tools._retrieve_kb("glaucoma", kb_id="kb-1", region=None)

    assert "Failed to search knowledge base" in out[0]["error"]


def test_retrieve_kb_wraps_unexpected_error(fake_runtime):
    fake_runtime(raises=RuntimeError("boom"))

    out = kb_tools._retrieve_kb("glaucoma", kb_id="kb-1", region=None)

    assert "boom" in out[0]["error"]


# ── search_medical_kb ─────────────────────────────────────────────────────────
def test_search_medical_kb_requires_env(monkeypatch):
    monkeypatch.delenv("AWS_KNOWLEDGE_BASE_ID", raising=False)

    out = kb_tools.search_medical_kb("glaucoma")

    assert out == [{"error": "AWS_KNOWLEDGE_BASE_ID is not configured."}]


def test_search_medical_kb_returns_results(monkeypatch, fake_runtime):
    monkeypatch.setenv("AWS_KNOWLEDGE_BASE_ID", "kb-medical")
    monkeypatch.setenv("AWS_KB_REGION", "ap-southeast-1")
    client = fake_runtime(results=[_hit("Seek urgent care.")])

    out = kb_tools.search_medical_kb("severe eye pain")

    assert out == [{"rank": 1, "content": "Seek urgent care.", "score": 0.9}]
    assert client.calls[0]["knowledgeBaseId"] == "kb-medical"


def test_search_medical_kb_propagates_retrieval_error(monkeypatch, fake_runtime):
    monkeypatch.setenv("AWS_KNOWLEDGE_BASE_ID", "kb-medical")
    fake_runtime(raises=RuntimeError("kb down"))

    out = kb_tools.search_medical_kb("glaucoma")

    assert "error" in out[0]


# ── search_financial_kb ───────────────────────────────────────────────────────
def test_search_financial_kb_requires_env(monkeypatch):
    monkeypatch.delenv("AWS_FINANCIAL_KNOWLEDGE_BASE_ID", raising=False)
    monkeypatch.delenv("AWS_KNOWLEDGE_BASE_ID", raising=False)

    out = kb_tools.search_financial_kb("bill")

    assert "AWS_FINANCIAL_KNOWLEDGE_BASE_ID is not configured" in out[0]["error"]


def test_search_financial_kb_prefers_financial_kb(monkeypatch, fake_runtime):
    monkeypatch.setenv("AWS_FINANCIAL_KNOWLEDGE_BASE_ID", "kb-fin")
    monkeypatch.setenv("AWS_KNOWLEDGE_BASE_ID", "kb-generic")
    client = fake_runtime(results=[_hit("Subsidy applies.")])

    out = kb_tools.search_financial_kb("subsidy")

    assert out[0]["content"] == "Subsidy applies."
    assert client.calls[0]["knowledgeBaseId"] == "kb-fin"


def test_search_financial_kb_falls_back_to_generic_kb(monkeypatch, fake_runtime):
    monkeypatch.delenv("AWS_FINANCIAL_KNOWLEDGE_BASE_ID", raising=False)
    monkeypatch.setenv("AWS_KNOWLEDGE_BASE_ID", "kb-generic")
    client = fake_runtime(results=[])

    kb_tools.search_financial_kb("subsidy")

    assert client.calls[0]["knowledgeBaseId"] == "kb-generic"


def test_search_financial_kb_prefers_financial_region(monkeypatch, fake_runtime):
    monkeypatch.setenv("AWS_FINANCIAL_KNOWLEDGE_BASE_ID", "kb-fin")
    monkeypatch.setenv("AWS_FINANCIAL_KB_REGION", "ap-southeast-1")
    captured = {}

    def _client(service, region_name=None, **_kw):
        captured["region"] = region_name
        return _FakeAgentRuntime(results=[])

    monkeypatch.setattr(kb_tools.boto3, "client", _client)

    kb_tools.search_financial_kb("subsidy")

    assert captured["region"] == "ap-southeast-1"


# ── format_kb_response ────────────────────────────────────────────────────────
def test_format_kb_response_handles_no_results():
    out = kb_tools.format_kb_response([])

    assert "could not find relevant information in the TTSH Library" in out


def test_format_kb_response_surfaces_error():
    assert kb_tools.format_kb_response([{"error": "kb unavailable"}]) == "kb unavailable"


def test_format_kb_response_lists_up_to_three_snippets():
    results = [{"content": f"fact {i}"} for i in range(5)]

    out = kb_tools.format_kb_response(results)

    assert "- fact 0" in out and "- fact 1" in out and "- fact 2" in out
    assert "fact 3" not in out
    assert "consult a licensed clinician" in out


def test_format_kb_response_handles_blank_snippets():
    out = kb_tools.format_kb_response([{"content": "   "}, {"content": ""}])

    assert "could not find relevant information in the TTSH Library" in out


# ── format_financial_kb_response ──────────────────────────────────────────────
def test_format_financial_kb_response_handles_no_results():
    out = kb_tools.format_financial_kb_response([])

    assert "verify details with your hospital billing team" in out


def test_format_financial_kb_response_surfaces_error():
    assert kb_tools.format_financial_kb_response([{"error": "no kb"}]) == "no kb"


def test_format_financial_kb_response_lists_snippets():
    out = kb_tools.format_financial_kb_response([{"content": "Medisave covers part."}])

    assert "- Medisave covers part." in out
    assert "official billing and finance channels" in out


def test_format_financial_kb_response_handles_blank_snippets():
    out = kb_tools.format_financial_kb_response([{"content": ""}])

    assert "verify details with your hospital billing team" in out
