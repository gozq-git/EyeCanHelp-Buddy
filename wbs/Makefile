# EyeCanHelp Buddy — test & artifact targets
# All reports land in ./reports and are served by `make reports`.

.PHONY: help install test-all test-backend test-frontend test-e2e test-load reports reports-down

help:
	@echo "Targets:"
	@echo "  install        Install backend (dev) + frontend + e2e test dependencies"
	@echo "  test-all       Run every test suite and generate all artifacts"
	@echo "  test-backend   Backend unit + integration (pytest) + coverage"
	@echo "  test-frontend  Frontend component tests (vitest) + coverage"
	@echo "  test-e2e       End-to-end tests (Playwright, via Docker by default)"
	@echo "  test-load      Stress/load tests (Locust)"
	@echo "  reports        Serve generated artifacts at http://localhost:8080"
	@echo "  reports-down   Stop the reports server"

install:
	cd backend && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
	cd frontend && npm install
	cd e2e && npm install && npx playwright install chromium

test-all:
	./scripts/run-all-tests.sh all

test-backend:
	./scripts/run-all-tests.sh backend

test-frontend:
	./scripts/run-all-tests.sh frontend

test-e2e:
	./scripts/run-all-tests.sh e2e

test-load:
	./scripts/run-all-tests.sh load

reports:
	docker compose up reports

reports-down:
	docker compose stop reports
