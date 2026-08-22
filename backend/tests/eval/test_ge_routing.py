"""Triage-routing evals: each golden must land on its expected route.

Deterministic (no judge calls): the coordinator records the resolved route in
the final graph state, so these are exact-equality checks against the golden's
expected_route. Covers healthcare / financial / out_of_scope / escalate.
"""
import pytest

from helpers import (
    OUT_OF_SCOPE_MARKER,
    golden_id,
    load_goldens,
    with_expected_route,
)

pytestmark = pytest.mark.eval

ROUTED = with_expected_route(load_goldens())


@pytest.mark.parametrize("golden", ROUTED, ids=golden_id)
def test_triage_route(golden, run_agent):
    state = run_agent(golden)
    actual = state.get("route")

    assert actual == golden["expected_route"], (
        f"[{golden['id']}] expected route {golden['expected_route']!r}, got "
        f"{actual!r} for input: {golden['input']}"
    )

    if golden["expected_route"] == "out_of_scope":
        assert OUT_OF_SCOPE_MARKER in str(state.get("response", "")), (
            f"[{golden['id']}] out-of-scope input did not get the polite refusal"
        )
