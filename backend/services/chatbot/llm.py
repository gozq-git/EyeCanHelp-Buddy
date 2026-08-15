import asyncio
import json
import os
import uuid
from collections.abc import AsyncIterator

import boto3
import httpx

CONTENT_TYPE_JSON = "application/json"
CONTENT_TYPE_SSE = "text/event-stream"
SSE_DATA_PREFIX = "data: "

# Keys a JSON coordinator response may carry the reply text under, in priority order.
JSON_TEXT_KEYS = ("response", "result", "output")


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


def _extract_json_text(raw_text: str) -> str:
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        return raw_text

    if isinstance(parsed, dict):
        for key in JSON_TEXT_KEYS:
            if key in parsed:
                return str(parsed[key])
    return raw_text


def _extract_sse_text(raw_text: str) -> str:
    chunks = [
        _decode_sse_payload(line[len(SSE_DATA_PREFIX):])
        for line in raw_text.splitlines()
        if line.startswith(SSE_DATA_PREFIX)
    ]
    return "\n".join(chunks).strip() or raw_text


def _extract_text(content_type: str, raw_text: str) -> str:
    if CONTENT_TYPE_JSON in content_type:
        return _extract_json_text(raw_text)

    if CONTENT_TYPE_SSE in content_type:
        return _extract_sse_text(raw_text)

    return raw_text


def _extract_region_from_arn(arn: str) -> str:
    parts = arn.split(":")
    if len(parts) < 4 or parts[2] != "bedrock-agentcore":
        raise ValueError(f"Invalid AgentCore runtime ARN: {arn}")
    return parts[3]


def _extract_runtime_response(response: dict) -> str:
    content_type = str(response.get("contentType", ""))
    stream = response.get("response")

    if CONTENT_TYPE_SSE in content_type and stream is not None:
        chunks: list[str] = []
        for line in stream.iter_lines(chunk_size=10):
            if not line:
                continue
            text = line.decode("utf-8")
            if text.startswith(SSE_DATA_PREFIX):
                text = _decode_sse_payload(text[6:])
            chunks.append(text)
        return "\n".join(chunks).strip()

    if CONTENT_TYPE_JSON in content_type and stream is not None:
        chunks = [chunk.decode("utf-8") for chunk in stream]
        raw = "".join(chunks)
        return _extract_text(CONTENT_TYPE_JSON, raw).strip()

    if stream is not None and hasattr(stream, "read"):
        return stream.read().decode("utf-8").strip()

    return ""


def _decode_chunk(chunk) -> str:
    if isinstance(chunk, bytes):
        return chunk.decode("utf-8")
    return str(chunk)


def _decode_sse_payload(payload: str) -> str:
    """Decode SSE data field value, including JSON-encoded strings from AgentCore."""
    text = (payload or "").strip()
    if not text:
        return ""

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return text

    if isinstance(parsed, str):
        return parsed

    if isinstance(parsed, dict):
        for key in ("response", "text", "message", "error"):
            value = parsed.get(key)
            if value is not None:
                return str(value)
        return json.dumps(parsed, ensure_ascii=False)

    return str(parsed)


def _next_or_none(iterator):
    try:
        return next(iterator)
    except StopIteration:
        return None


def _chunk_text(text: str, chunk_size: int = 24) -> list[str]:
    if not text:
        return []
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]


async def _stream_sse_lines(stream) -> AsyncIterator[str]:
    """Yield the decoded payload of every non-empty SSE line off the event loop."""
    iterator = stream.iter_lines(chunk_size=10)
    while True:
        line = await asyncio.to_thread(_next_or_none, iterator)
        if line is None:
            break
        text = _decode_chunk(line).strip()
        if text.startswith(SSE_DATA_PREFIX):
            text = _decode_sse_payload(text[len(SSE_DATA_PREFIX):])
        if text:
            yield text


async def _collect_json_stream(stream) -> str:
    """Drain a chunked JSON body and pull the reply text out of it."""
    iterator = iter(stream)
    pieces: list[str] = []
    while True:
        chunk = await asyncio.to_thread(_next_or_none, iterator)
        if chunk is None:
            break
        pieces.append(_decode_chunk(chunk))
    return _extract_text(CONTENT_TYPE_JSON, "".join(pieces)).strip()


async def _read_whole_stream(stream) -> str:
    raw = await asyncio.to_thread(stream.read)
    return _decode_chunk(raw).strip() if raw else ""


async def _stream_runtime_response(response: dict) -> AsyncIterator[str]:
    content_type = str(response.get("contentType", ""))
    stream = response.get("response")
    if stream is None:
        return

    if CONTENT_TYPE_SSE in content_type and hasattr(stream, "iter_lines"):
        async for text in _stream_sse_lines(stream):
            yield text
        return

    if CONTENT_TYPE_JSON in content_type and hasattr(stream, "__iter__"):
        for piece in _chunk_text(await _collect_json_stream(stream)):
            yield piece
        return

    if hasattr(stream, "read"):
        for piece in _chunk_text(await _read_whole_stream(stream)):
            yield piece


async def _invoke_with_runtime_arn_response(prompt: str, stream: bool = False) -> dict | None:
    runtime_arn = os.getenv("AGENTCORE_COORDINATOR_RUNTIME_ARN", "").strip()
    if not runtime_arn:
        return None

    region = os.getenv("AWS_REGION", "").strip() or _extract_region_from_arn(runtime_arn)
    session_id = os.getenv("AGENTCORE_RUNTIME_SESSION_ID", "").strip() or str(uuid.uuid4())
    payload = json.dumps({"prompt": prompt, "stream": stream}).encode("utf-8")
    request_content_type = os.getenv("AGENTCORE_REQUEST_CONTENT_TYPE", CONTENT_TYPE_JSON)
    response_accept = os.getenv("AGENTCORE_RESPONSE_ACCEPT", CONTENT_TYPE_SSE)

    client = boto3.client("bedrock-agentcore", region_name=region)
    response = await asyncio.to_thread(
        client.invoke_agent_runtime,
        agentRuntimeArn=runtime_arn,
        runtimeSessionId=session_id,
        payload=payload,
        contentType=request_content_type,
        accept=response_accept,
    )
    return response


async def _invoke_with_runtime_arn(prompt: str) -> str:
    response = await _invoke_with_runtime_arn_response(prompt, stream=False)
    if not response:
        return ""
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
    if not text:
        text = await _invoke_with_http_endpoint(prompt)

    if not text:
        return "No response returned from coordinator runtime."
    return text


async def chat_stream(messages: list[dict]) -> AsyncIterator[str]:
    prompt = _build_prompt(messages)

    response = await _invoke_with_runtime_arn_response(prompt, stream=True)
    if not response:
        return

    async for chunk in _stream_runtime_response(response):
        if chunk:
            yield chunk
