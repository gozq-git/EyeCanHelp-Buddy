#!/usr/bin/env python3
"""
Multi-agent runtime test script modeled after AgentCore sample test scripts.

Usage:
  python tests/test_multi_agent.py <coordinator_runtime_arn> [financial_runtime_arn] [healthcare_runtime_arn]
"""

import json
import sys
from typing import Optional

import boto3


def extract_region_from_arn(arn: str) -> str:
    parts = arn.split(":")
    if len(parts) < 4 or parts[2] != "bedrock-agentcore":
        raise ValueError(f"Invalid AgentCore runtime ARN: {arn}")
    return parts[3]


def invoke_runtime(client, runtime_arn: str, prompt: str) -> str:
    response = client.invoke_agent_runtime(
        agentRuntimeArn=runtime_arn,
        qualifier="DEFAULT",
        payload=json.dumps({"prompt": prompt}),
    )

    content_type = response.get("contentType", "")
    stream = response.get("response")

    if "text/event-stream" in content_type and stream is not None:
        chunks = []
        for line in stream.iter_lines(chunk_size=10):
            if line:
                text = line.decode("utf-8")
                if text.startswith("data: "):
                    text = text[6:]
                chunks.append(text)
        return "\n".join(chunks).strip()

    if content_type == "application/json" and stream is not None:
        chunks = [chunk.decode("utf-8") for chunk in stream]
        raw = "".join(chunks)
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                if "response" in parsed:
                    return str(parsed["response"])
                if "result" in parsed:
                    return str(parsed["result"])
            return raw
        except json.JSONDecodeError:
            return raw

    if stream is not None and hasattr(stream, "read"):
        return stream.read().decode("utf-8")

    return "No response returned from runtime."


def test_runtime(client, runtime_arn: str, name: str, prompt: str) -> None:
    print("\n" + "=" * 80)
    print(f"TEST: {name}")
    print("=" * 80)
    print(f"Prompt: {prompt}")
    try:
        result = invoke_runtime(client, runtime_arn, prompt)
        print("\nResponse:")
        print(result)
    except Exception as exc:
        print(f"\nError invoking {name}: {exc}")


def test_multi_agent(
    coordinator_arn: str,
    financial_arn: Optional[str] = None,
    healthcare_arn: Optional[str] = None,
) -> None:
    region = extract_region_from_arn(coordinator_arn)
    client = boto3.client("bedrock-agentcore", region_name=region)

    print("\n" + "=" * 80)
    print("MULTI-AGENT SYSTEM TEST")
    print("=" * 80)
    print(f"Region: {region}")
    print(f"Coordinator ARN: {coordinator_arn}")

    test_runtime(
        client,
        coordinator_arn,
        "Coordinator (financial query)",
        "Create a monthly budget for income of 7000 with a debt payoff plan.",
    )
    test_runtime(
        client,
        coordinator_arn,
        "Coordinator (healthcare query)",
        "I have a fever for two days and sore throat, what next steps should I take?",
    )

    if financial_arn:
        test_runtime(
            client,
            financial_arn,
            "Financial Specialist",
            "Compare avalanche vs snowball debt payoff methods.",
        )

    if healthcare_arn:
        test_runtime(
            client,
            healthcare_arn,
            "Healthcare Specialist",
            "What are warning signs that need urgent care for chest pain?",
        )


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    coordinator_arn = sys.argv[1]
    financial_arn = sys.argv[2] if len(sys.argv) > 2 else None
    healthcare_arn = sys.argv[3] if len(sys.argv) > 3 else None

    test_multi_agent(coordinator_arn, financial_arn, healthcare_arn)


if __name__ == "__main__":
    main()
