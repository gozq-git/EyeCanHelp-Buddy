# Backend Tests

Automated test suite for the FastAPI backend. See
[`wbs/TESTING.md`](../../wbs/TESTING.md) for the full picture (frontend, E2E, load).

## Layout

```
tests/
├── conftest.py            # shared fixtures: in-memory SQLite (sync shim), fake
│                          #   Mongo, TestClient with all I/O dependencies overridden
├── unit/                  # fast, isolated — no DB / no network
│   ├── test_billing_service.py, test_epic_service.py, test_schemas.py, ...
│   ├── test_coordinator_*.py           # coordinator core: graph, triage, LLM helpers
│   ├── test_financial_specialist.py    # specialist plug-ins
│   ├── test_healthcare_specialist.py
│   └── test_specialist_rag.py, test_kb_tools.py
├── integration/           # full FastAPI routes via TestClient
│   ├── test_root_api.py
│   ├── test_chatbot_api.py             # LLM/AgentCore mocked
│   ├── test_epic_api.py                # EPIC facade mocked
│   ├── test_patient_api.py             # SQLite-backed ORM round-trip
│   ├── test_notifications_api.py       # Gmail API path mocked
│   └── test_acknowledgement_api.py
├── eval/                  # opt-in DeepEval suite (live Bedrock; see eval/README.md)
└── load/
    └── locustfile.py      # stress test (driven by locust, not pytest)
```

## Running

```powershell
# from backend/
.\.venv\Scripts\python.exe -m pytest                 # unit + integration
.\.venv\Scripts\python.exe -m pytest tests/unit      # unit only
.\.venv\Scripts\python.exe -m pytest -m integration  # integration only

# with coverage + HTML artifacts (written to ../reports/backend)
.\.venv\Scripts\python.exe -m pytest `
  --cov=services --cov=database `
  --cov-report=html:../reports/backend/coverage `
  --html=../reports/backend/report.html --self-contained-html
```

`pytest.ini` excludes `tests/load` and `tests/eval` from the default collection.

## Design

* **No external services.** PostgreSQL → in-memory SQLite via a synchronous
  engine wrapped in an async shim (see `conftest.py`), MongoDB → in-process
  fake, LLM/AgentCore → mocked. The FastAPI lifespan's DB init is patched to
  no-ops so the TestClient starts instantly and offline.
* **Unit** tests target pure logic (billing math, prompt building, response
  parsing, schema validation, EPIC service behavior, coordinator/specialist
  routing).
* **Integration** tests exercise each `/api/...` route end-to-end through the
  real FastAPI stack with those dependencies overridden.

## Eval suite

`tests/eval/` is an opt-in DeepEval suite that makes real AWS Bedrock calls
(relevancy, faithfulness, safety, routing, multilingual). It skips cleanly
without AWS credentials or KB/guardrail env vars. See [eval/README.md](eval/README.md).

```powershell
.\.venv\Scripts\python.exe -m pytest tests/eval -m eval -v
```
