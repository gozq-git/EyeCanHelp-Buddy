"""Stress / load tests for the EyeCanHelp Buddy backend (Locust).

Targets the endpoint that needs neither AWS AgentCore nor a live database:
    * GET /    health check

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

from locust import HttpUser, between, task


class BackendUser(HttpUser):
    # Think-time between requests for a single simulated user.
    wait_time = between(0.1, 0.5)

    @task
    def health_check(self):
        self.client.get("/", name="GET /")
