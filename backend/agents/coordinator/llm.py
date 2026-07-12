"""Shared Bedrock helpers used by the microkernel core and every specialist plug-in.

Extracted out of ``agent.py`` so that specialist plug-ins under ``specialists/``
can call the model without importing the core (which would create a circular
import: core -> specialists -> core).
"""
import os

import boto3


def _build_converse_args(system_prompt: str, user_prompt: str, temperature: float) -> dict:
    return {
        "system": [{"text": system_prompt}],
        "messages": [{"role": "user", "content": [{"text": user_prompt}]}],
        "inferenceConfig": {"temperature": temperature},
    }


def _collect_stream_text(response: dict) -> str:
    stream = response.get("stream")
    if stream is None:
        return ""

    text_parts: list[str] = []
    for event in stream:
        if not isinstance(event, dict):
            continue
        delta = event.get("contentBlockDelta", {}).get("delta", {})
        text = delta.get("text") if isinstance(delta, dict) else None
        if text:
            text_parts.append(str(text))
    return "".join(text_parts).strip()


def invoke_model(system_prompt: str, user_prompt: str) -> str:
    """Single Bedrock model call. Returns plain text (never raises).

    Uses ``converse_stream`` for lower-latency token delivery from Bedrock, then
    aggregates chunks so existing coordinator/specialist call sites remain stable.
    """
    model_name = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-6")
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
    temperature = float(os.getenv("BEDROCK_TEMPERATURE", "0.2"))

    try:
        client = boto3.client("bedrock-runtime", region_name=region)
        args = _build_converse_args(system_prompt, user_prompt, temperature)

        # Prefer streaming API for token-level Bedrock delivery.
        response = client.converse_stream(modelId=model_name, **args)
        text = _collect_stream_text(response)
        if text:
            return text

        # Safety fallback when streaming payload is empty for any reason.
        fallback = client.converse(modelId=model_name, **args)
        output = fallback.get("output", {}).get("message", {}).get("content", [])
        text_parts = [str(item.get("text", "")).strip() for item in output if isinstance(item, dict)]
        text = "\n".join(part for part in text_parts if part)
        return text or "No response returned from Bedrock model."
    except Exception as exc:
        return f"I could not generate a model response from Bedrock: {str(exc)}"


def extract_latest_user_input(prompt: str) -> str:
    """Pull the most recent ``USER:`` line out of a transcript-style prompt."""
    lines = [line.strip() for line in (prompt or "").splitlines() if line.strip()]
    for line in reversed(lines):
        if line.upper().startswith("USER:"):
            return line[5:].strip()
    return (prompt or "").strip()
