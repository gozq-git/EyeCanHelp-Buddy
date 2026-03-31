import json
import os

import boto3


class SubAgentRouter:
    """Routes coordinator requests to specialist runtimes."""

    def __init__(self) -> None:
        self.region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
        self.financial_runtime_arn = os.getenv("FINANCIAL_AGENT_RUNTIME_ARN")
        self.healthcare_runtime_arn = os.getenv("HEALTHCARE_AGENT_RUNTIME_ARN")
        self.client = boto3.client("bedrock-agentcore", region_name=self.region)

    def invoke_runtime(self, runtime_arn: str, query: str) -> str:
        if not runtime_arn:
            raise ValueError("Specialist runtime ARN is required")

        response = self.client.invoke_agent_runtime(
            agentRuntimeArn=runtime_arn,
            qualifier="DEFAULT",
            payload=json.dumps({"prompt": query}),
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

        return "No response returned from specialist runtime."

    def route_to_financial(self, query: str) -> str:
        return self.invoke_runtime(self.financial_runtime_arn or "", query)

    def route_to_healthcare(self, query: str) -> str:
        return self.invoke_runtime(self.healthcare_runtime_arn or "", query)
