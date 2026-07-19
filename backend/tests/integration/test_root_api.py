"""Integration test for the root health check endpoint."""
import pytest

pytestmark = pytest.mark.integration


def test_root_health_check(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"message": "EyeCanHelp Buddy API is running"}
