"""Unit tests for the pure helper functions in services/llm_service.py.

These cover the deterministic transcript-building and response-parsing logic
without invoking AgentCore / AWS.
"""
import pytest

from services.llm_service import (
    _build_prompt,
    _extract_text,
    _extract_region_from_arn,
)

pytestmark = pytest.mark.unit


# ── _build_prompt ─────────────────────────────────────────────────────────────
def test_build_prompt_formats_roles_uppercase():
    messages = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"},
    ]
    assert _build_prompt(messages) == "USER: Hello\nASSISTANT: Hi there"


def test_build_prompt_skips_empty_content():
    messages = [
        {"role": "user", "content": "  "},
        {"role": "user", "content": "real question"},
    ]
    assert _build_prompt(messages) == "USER: real question"


def test_build_prompt_handles_empty_list():
    assert _build_prompt([]) == ""


# ── _extract_text ─────────────────────────────────────────────────────────────
def test_extract_text_json_response_key():
    assert _extract_text("application/json", '{"response": "answer"}') == "answer"


def test_extract_text_json_result_key():
    assert _extract_text("application/json", '{"result": "answer"}') == "answer"


def test_extract_text_json_output_key():
    assert _extract_text("application/json", '{"output": "answer"}') == "answer"


def test_extract_text_invalid_json_returns_raw():
    assert _extract_text("application/json", "not json") == "not json"


def test_extract_text_event_stream():
    raw = "data: line one\ndata: line two"
    assert _extract_text("text/event-stream", raw) == "line one\nline two"


def test_extract_text_plain_passthrough():
    assert _extract_text("text/plain", "just text") == "just text"


# ── _extract_region_from_arn ──────────────────────────────────────────────────
def test_extract_region_from_valid_arn():
    arn = "arn:aws:bedrock-agentcore:ap-southeast-1:123456789012:runtime/abc"
    assert _extract_region_from_arn(arn) == "ap-southeast-1"


@pytest.mark.parametrize("arn", ["", "not-an-arn", "arn:aws:s3:::bucket"])
def test_extract_region_from_invalid_arn_raises(arn):
    with pytest.raises(ValueError):
        _extract_region_from_arn(arn)
