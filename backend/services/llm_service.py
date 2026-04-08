import asyncio
import json
import os
import uuid

import boto3
import httpx


def _build_prompt(messages: list[dict]) -> str:
    # Convert chat history into a simple transcript expected by the coordinator runtime.
    lines: list[str] = []
    for msg in messages:
        role = str(msg.get("role", "user")).strip().upper()
        content = str(msg.get("content", "")).strip()
        if not content:
            continue
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _extract_text(content_type: str, raw_text: str) -> str:
    if "application/json" in content_type:
        try:
            parsed = json.loads(raw_text)
            if isinstance(parsed, dict):
                if "response" in parsed:
                    return str(parsed["response"])
                if "result" in parsed:
                    return str(parsed["result"])
                if "output" in parsed:
                    return str(parsed["output"])
            return raw_text
        except json.JSONDecodeError:
            return raw_text

    if "text/event-stream" in content_type:
        chunks: list[str] = []
        for line in raw_text.splitlines():
            if line.startswith("data: "):
                chunks.append(line[6:])
        return "\n".join(chunks).strip() or raw_text

    return raw_text


def _extract_region_from_arn(arn: str) -> str:
    parts = arn.split(":")
    if len(parts) < 4 or parts[2] != "bedrock-agentcore":
        raise ValueError(f"Invalid AgentCore runtime ARN: {arn}")
    return parts[3]


def _extract_runtime_response(response: dict) -> str:
    content_type = str(response.get("contentType", ""))
    stream = response.get("response")

    if "text/event-stream" in content_type and stream is not None:
        chunks: list[str] = []
        for line in stream.iter_lines(chunk_size=10):
            if not line:
                continue
            text = line.decode("utf-8")
            if text.startswith("data: "):
                text = text[6:]
            chunks.append(text)
        return "\n".join(chunks).strip()

    if "application/json" in content_type and stream is not None:
        chunks = [chunk.decode("utf-8") for chunk in stream]
        raw = "".join(chunks)
        return _extract_text("application/json", raw).strip()

    if stream is not None and hasattr(stream, "read"):
        return stream.read().decode("utf-8").strip()

    return ""


async def _invoke_with_runtime_arn(prompt: str) -> str:
    runtime_arn = os.getenv("AGENTCORE_COORDINATOR_RUNTIME_ARN", "").strip()
    if not runtime_arn:
        return ""

    region = os.getenv("AWS_REGION", "").strip() or _extract_region_from_arn(runtime_arn)
    session_id = os.getenv("AGENTCORE_RUNTIME_SESSION_ID", "").strip() or str(uuid.uuid4())
    payload = json.dumps({"prompt": prompt}).encode("utf-8")

    client = boto3.client("bedrock-agentcore", region_name=region)
    response = await asyncio.to_thread(
        client.invoke_agent_runtime,
        agentRuntimeArn=runtime_arn,
        runtimeSessionId=session_id,
        payload=payload,
    )
    return _extract_runtime_response(response)


async def _invoke_with_http_endpoint(prompt: str) -> str:
    endpoint = os.getenv("AGENTCORE_COORDINATOR_ENDPOINT", "http://127.0.0.1:8080/invocations")
    timeout = float(os.getenv("AGENTCORE_TIMEOUT_SECONDS", "30"))

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(endpoint, json={"prompt": prompt})

    response.raise_for_status()
    return _extract_text(response.headers.get("content-type", ""), response.text).strip()


async def chat(messages: list[dict]) -> str:
    prompt = _build_prompt(messages)

    text = await _invoke_with_runtime_arn(prompt)
    # if not text:
    #     text = await _invoke_with_http_endpoint(prompt)

    # if not text:
    #     return "No response returned from coordinator runtime."
    return text
