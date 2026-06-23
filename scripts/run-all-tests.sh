#!/usr/bin/env bash
#
# Generate every test artifact into ./reports, ready to be served by the
# `reports` Docker service (http://localhost:8088).
#
# Usage:
#   scripts/run-all-tests.sh [all|backend|frontend|e2e|load]   (default: all)
#
# Notes:
#   * E2E runs inside the official Playwright Docker image, so no browser system
#     libraries need to be installed on the host. Set E2E_LOCAL=1 to run it with
#     a locally-installed Playwright instead.
#   * The load test starts a throwaway backend on port 8000 and stops it after.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORTS="$ROOT/reports"
TARGET="${1:-all}"

PYTHON="$ROOT/backend/.venv/bin/python"
[ -x "$PYTHON" ] || PYTHON="python3"

PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v1.49.1-jammy"

green() { printf '\033[1;32m==> %s\033[0m\n' "$*"; }
red()   { printf '\033[1;31m!!! %s\033[0m\n' "$*"; }

run_backend() {
  green "Backend: pytest (unit + integration) with coverage"
  mkdir -p "$REPORTS/backend"
  ( cd "$ROOT/backend" && "$PYTHON" -m pytest \
      --cov=services --cov=routers --cov=schemas --cov=models --cov=database \
      --cov-report=term-missing \
      --cov-report="html:$REPORTS/backend/coverage" \
      --html="$REPORTS/backend/report.html" --self-contained-html )
}

run_frontend() {
  green "Frontend: vitest with coverage"
  ( cd "$ROOT/frontend" && npm run test:coverage )
}

run_e2e() {
  green "E2E: starting Vite dev server"
  ( cd "$ROOT/frontend" && npm run dev -- --port 3000 --host 127.0.0.1 ) >/tmp/eyecan-vite.log 2>&1 &
  local vite_pid=$!
  trap '[ -n "${vite_pid:-}" ] && kill "$vite_pid" 2>/dev/null' RETURN

  for _ in $(seq 1 60); do curl -sf http://127.0.0.1:3000 >/dev/null 2>&1 && break; sleep 1; done

  if [ "${E2E_LOCAL:-0}" = "1" ]; then
    green "E2E: running Playwright locally"
    ( cd "$ROOT/e2e" && E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://localhost:3000 npx playwright test )
  else
    green "E2E: running Playwright in Docker ($PLAYWRIGHT_IMAGE)"
    docker run --rm --network host \
      --user "$(id -u):$(id -g)" -e HOME=/tmp \
      -e E2E_SKIP_WEBSERVER=1 -e E2E_BASE_URL=http://localhost:3000 \
      -v "$ROOT":/work -w /work/e2e \
      "$PLAYWRIGHT_IMAGE" npx playwright test
  fi
}

run_load() {
  green "Load: starting throwaway backend on :8000"
  mkdir -p "$REPORTS/load"
  ( cd "$ROOT/backend" && \
    MONGO_URL="mongodb://localhost:27017/?serverSelectionTimeoutMS=500" \
    "$PYTHON" -m uvicorn main:app --host 127.0.0.1 --port 8000 ) >/tmp/eyecan-uvicorn.log 2>&1 &
  local uv_pid=$!
  trap '[ -n "${uv_pid:-}" ] && kill "$uv_pid" 2>/dev/null' RETURN

  for _ in $(seq 1 30); do curl -sf http://127.0.0.1:8000/ >/dev/null 2>&1 && break; sleep 1; done

  green "Load: running Locust (headless, 50 users, 30s)"
  ( cd "$ROOT/backend" && "$PYTHON" -m locust -f tests/load/locustfile.py \
      --host http://127.0.0.1:8000 \
      --headless -u 50 -r 10 -t 30s \
      --html "$REPORTS/load/report.html" )
}

case "$TARGET" in
  backend)  run_backend ;;
  frontend) run_frontend ;;
  e2e)      run_e2e ;;
  load)     run_load ;;
  all)      run_backend; run_frontend; run_e2e; run_load ;;
  *) red "Unknown target '$TARGET' (use: all|backend|frontend|e2e|load)"; exit 2 ;;
esac

green "Done. Serve the artifacts with:  docker compose up reports   →   http://localhost:8088"
