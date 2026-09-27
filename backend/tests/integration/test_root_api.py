"""Integration test for the root health check endpoint."""
import pytest

pytestmark = pytest.mark.integration


def test_root_health_check(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"message": "EyeCanHelp Buddy API is running"}
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["x-frame-options"] == "DENY"
    assert resp.headers["cross-origin-opener-policy"] == "same-origin"
    assert resp.headers["cross-origin-embedder-policy"] == "require-corp"
    assert resp.headers["cross-origin-resource-policy"] == "same-origin"
    assert resp.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"
