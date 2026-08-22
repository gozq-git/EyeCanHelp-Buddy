"""Fixtures for the opt-in DeepEval suite (tests/eval).

Unlike the rest of the backend suite, these tests make REAL AWS Bedrock calls —
both to produce chatbot answers (the coordinator agent, in-process) and to judge
them (deepeval's AmazonBedrockModel). The folder is excluded from the default
pytest run (see pytest.ini) and runs only via `make test-eval` or
`python -m pytest tests/eval`.

The whole suite SKIPS (never fails) when:
  * deepeval is not installed  → pip install -r requirements-dev.txt
  * boto3 cannot resolve AWS credentials / reach STS

This conftest is deliberately self-contained: it does NOT reuse the fixtures in
tests/conftest.py, because those exist to mock away exactly the LLM calls this
suite wants to exercise for real.
"""
import importlib.util
import os
import sys
from pathlib import Path

import pytest

# tests/eval -> tests -> backend
BACKEND_DIR = Path(__file__).resolve().parents[2]
# Coordinator modules (agent, llm, specialists, tools) import each other as
# top-level modules, so agents/coordinator must be importable on its own —
# same pattern as tests/unit/test_coordinator_agent.py.
COORDINATOR_DIR = BACKEND_DIR / "agents" / "coordinator"
for _path in (str(BACKEND_DIR), str(COORDINATOR_DIR)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

DEFAULT_JUDGE_MODEL = "global.anthropic.claude-sonnet-4-6"


def aws_region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"


@pytest.fixture(scope="session", autouse=True)
def eval_prerequisites():
    """Gate the whole suite on deepeval being installed and AWS being reachable."""
    if importlib.util.find_spec("deepeval") is None:
        pytest.skip("deepeval is not installed — run: pip install -r requirements-dev.txt")

    import boto3

    try:
        boto3.client("sts", region_name=aws_region()).get_caller_identity()
    except Exception as exc:  # NoCredentialsError, expired token, no network, ...
        pytest.skip(f"AWS credentials not available for the eval suite: {exc}")


@pytest.fixture(scope="session")
def judge(eval_prerequisites):
    """Bedrock Claude as the deepeval evaluation judge.

    Override with EVAL_JUDGE_MODEL_ID (e.g. a cheaper model) if judging cost or
    latency becomes a problem.
    """
    from deepeval.models import AmazonBedrockModel

    model_id = (
        os.getenv("EVAL_JUDGE_MODEL_ID")
        or os.getenv("BEDROCK_MODEL_ID")
        or DEFAULT_JUDGE_MODEL
    )
    return AmazonBedrockModel(model=model_id, region=aws_region())


@pytest.fixture(scope="session")
def agent(eval_prerequisites):
    """The compiled coordinator LangGraph (escalation gate → triage → specialist)."""
    import agent as coordinator_agent

    return coordinator_agent.create_agent()


@pytest.fixture(scope="session")
def run_agent(agent):
    """Invoke the real coordinator agent for a golden; memoized per session.

    Each golden costs one agent invocation no matter how many eval test modules
    consume it. Returns the final graph state (route / response / kb_results).
    """
    cache: dict[str, dict] = {}

    def _run(golden: dict) -> dict:
        gid = golden["id"]
        if gid not in cache:
            language = golden.get("language", "en")
            prompt = f"LANGUAGE: {language}\nUSER: {golden['input']}"
            cache[gid] = dict(agent.invoke({"prompt": prompt}))
        return cache[gid]

    return _run


@pytest.fixture(scope="session")
def require_kb(eval_prerequisites):
    """Skip faithfulness checks when no medical knowledge base is configured."""
    if not os.getenv("AWS_KNOWLEDGE_BASE_ID", "").strip():
        pytest.skip(
            "AWS_KNOWLEDGE_BASE_ID is not set — no retrieval context to evaluate against"
        )
