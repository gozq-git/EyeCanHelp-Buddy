"""Stress / load tests for the EyeCanHelp Buddy backend (Locust).

Targets only the endpoints that need neither AWS AgentCore nor a live database:
  * GET  /                health check
  * POST /api/symptoms    UC3 triage (pure CPU classification)

This keeps the load test deterministic and runnable against a backend started
with no external services.

Run headless and emit an HTML artifact:

    locust -f tests/load/locustfile.py \
        --host http://localhost:8000 \
        --headless -u 50 -r 10 -t 30s \
        --html ../reports/load/report.html

  -u  number of concurrent users
  -r  spawn rate (users/sec)
  -t  total run time
"""
import random

from locust import HttpUser, between, task

SYMPTOM_SAMPLES = [
    "I see floaters and flashes of light",          # severe
    "sudden vision loss in my right eye",           # severe
    "just mild discomfort and a watery eye",        # mild
    "slight irritation and light sensitivity",      # mild
    "I feel completely fine today",                 # unclear
]


class BackendUser(HttpUser):
    # Think-time between requests for a single simulated user.
    wait_time = between(0.1, 0.5)

    @task(1)
    def health_check(self):
        self.client.get("/", name="GET /")

    @task(3)
    def assess_symptoms(self):
        payload = {
            "patient_id": f"P{random.randint(1, 999):03d}",
            "symptom_description": random.choice(SYMPTOM_SAMPLES),
        }
        with self.client.post("/api/symptoms", json=payload, name="POST /api/symptoms", catch_response=True) as resp:
            if resp.status_code == 200 and resp.json().get("severity") in {"mild", "severe", "unclear"}:
                resp.success()
            else:
                resp.failure(f"unexpected response: {resp.status_code} {resp.text[:120]}")
