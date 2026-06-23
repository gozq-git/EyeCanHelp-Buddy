# Backend Tests

Automated test suite for the FastAPI backend. See
[`wbs/TESTING.md`](../../wbs/TESTING.md) for the full picture (frontend, E2E, load) and
the artifact page.

## Layout

```
tests/
├── conftest.py            # shared fixtures: in-memory SQLite, fake Mongo,
│                          #   TestClient with all I/O dependencies overridden
├── unit/                  # fast, isolated — no DB / no network
│   ├── test_symptom_service.py
│   ├── test_llm_service.py     # pure transcript/response-parsing helpers
│   └── test_schemas.py
├── integration/           # full FastAPI routes via TestClient
│   ├── test_root_and_symptom.py
│   ├── test_chatbot_api.py     # LLM/AgentCore mocked
│   ├── test_epic_api.py        # EPIC facade mocked
│   ├── test_patient_api.py     # SQLite-backed ORM round-trip
│   └── test_acknowledgement_api.py
├── load/
│   └── locustfile.py      # stress test (driven by locust, not pytest)
└── test_multi_agent.py    # MANUAL AgentCore runtime script (needs live AWS ARNs)
```

## Running

```bash
# from backend/
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt   # first time
.venv/bin/python -m pytest                # unit + integration
.venv/bin/python -m pytest tests/unit     # unit only
.venv/bin/python -m pytest -m integration # integration only

# with coverage + HTML artifacts (written to ../reports/backend)
.venv/bin/python -m pytest \
  --cov=services --cov=routers --cov=schemas --cov=models --cov=database \
  --cov-report=html:../reports/backend/coverage \
  --html=../reports/backend/report.html --self-contained-html
```

`pytest.ini` excludes `tests/load` and the manual `test_multi_agent.py` from the
default collection.

## Design

* **No external services.** PostgreSQL → in-memory SQLite (aiosqlite), MongoDB →
  in-process fake, LLM/AgentCore → mocked. The FastAPI lifespan's DB init is
  patched to no-ops so the TestClient starts instantly and offline.
* **Unit** tests target pure logic (symptom classification, prompt building,
  response parsing, schema validation).
* **Integration** tests exercise each `/api/...` route end-to-end through the
  real FastAPI stack with those dependencies overridden.

## Manual AgentCore runtime test

`test_multi_agent.py` invokes deployed AgentCore runtimes and prints responses
(not part of the automated suite):

```bash
python tests/test_multi_agent.py <coordinator_arn> [financial_arn] [healthcare_arn]
```
