"""Shared Bedrock helpers used by the microkernel core and every specialist plug-in.

Extracted out of ``agent.py`` so that specialist plug-ins under ``specialists/``
can call the model without importing the core (which would create a circular
import: core -> specialists -> core).
"""
import os

import boto3


def invoke_model(system_prompt: str, user_prompt: str) -> str:
    """Single Bedrock ``converse`` call. Returns plain text (never raises)."""
    model_name = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-5-20250929-v1:0")
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
    temperature = float(os.getenv("BEDROCK_TEMPERATURE", "0.2"))

    try:
        client = boto3.client("bedrock-runtime", region_name=region)
        response = client.converse(
            modelId=model_name,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": user_prompt}]}],
            inferenceConfig={"temperature": temperature},
        )

        output = response.get("output", {}).get("message", {}).get("content", [])
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
