# Testing & Test Artifacts

This project is covered by four test levels. Every run writes an HTML artifact
into [`reports/`](../reports/), which is served as a single **artifact page** by a
Docker container.

| Level | Tooling | Location | Artifact |
|-------|---------|----------|----------|
| **Unit** (backend) | pytest | `backend/tests/unit/` | `reports/backend/report.html` + `reports/backend/coverage/` |
| **Unit** (frontend) | Vitest + RTL | `frontend/src/__tests__/` | `reports/frontend/coverage/` |
| **Integration** (API) | pytest + FastAPI `TestClient` | `backend/tests/integration/` | (in `reports/backend/report.html`) |
| **End-to-End** | Playwright | `e2e/tests/` | `reports/e2e/index.html` |
| **Stress / Load** | Locust | `backend/tests/load/` | `reports/load/report.html` |

External dependencies are isolated: the LLM/AgentCore call is mocked, PostgreSQL
is replaced by in-memory SQLite, and MongoDB by an in-process fake. E2E mocks the
backend at the network layer (`page.route`), so the whole suite runs offline.

---

## Quick sta

```bash
# 1. install test dependencies (one time)
make install

# 2. run everything and generate all artifacts
make test-all
#    …or a single level: make test-backend | test-frontend | test-e2e | test-load

# 3. load the artifact page in Docker
make reports                 # == docker compose up reports
#    open http://localhost:8088
```

`make` targets are thin wrappers around [`scripts/run-all-tests.sh`](../scripts/run-all-tests.sh).

---

## Running each level directly

### Backend — unit + integration (pytest)
```bash
cd backend
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt   # first time
.venv/bin/python -m pytest                                          # all backend tests
.venv/bin/python -m pytest tests/unit                               # unit only
.venv/bin/python -m pytest tests/integration                        # integration only
```
Config lives in `backend/pytest.ini`. Shared fixtures (SQLite engine, fake Mongo,
TestClient with dependencies overridden) are in `backend/tests/conftest.py`.

### Frontend — component tests (Vitest)
```bash
cd frontend
npm install            # first time
npm test               # run once
npm run test:coverage  # run + coverage → reports/frontend/coverage
```

### End-to-End (Playwright)
By default E2E runs inside the official Playwright Docker image, so you do **not**
need to install browser system libraries on the host:
```bash
./scripts/run-all-tests.sh e2e
```
To run it with a locally-installed Playwright instead:
```bash
cd e2e
npm install
npx playwright install --with-deps chromium   # needs sudo for system libs
E2E_LOCAL=1 ../scripts/run-all-tests.sh e2e
```

### Stress / Load (Locust)
```bash
./scripts/run-all-tests.sh load     # starts a throwaway backend, runs Locust, stops it
```
Or manually, against an already-running backend:
```bash
cd backend
.venv/bin/locust -f tests/load/locustfile.py --host http://localhost:8000 \
  --headless -u 50 -r 10 -t 30s --html ../reports/load/report.html
# Drop --headless to open the Locust web UI at http://localhost:8089
```

---

## The artifact page

`reports/index.html` is a landing page linking to every report. The `reports`
service in `docker-compose.yml` serves the `reports/` folder with nginx
(directory listing enabled):

```bash
docker compose up reports     # http://localhost:8088
```

Generated reports are git-ignored; only the page scaffolding
(`index.html`, `nginx.conf`, `.gitkeep`) is committed.

---

## Notes

* `backend/tests/test_multi_agent.py` is a **manual** AgentCore runtime script
  (needs live AWS ARNs) and is excluded from the automated pytest run.
* CI (`.github/workflows/frontend-cicd.yml`) already runs the frontend tests on
  every push; backend pytest and the other levels can be wired in the same way.
