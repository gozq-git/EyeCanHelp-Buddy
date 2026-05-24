import logging
import os
from typing import Any, Dict, List

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


def search_medical_kb(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Search a medical knowledge base using semantic retrieval."""
    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return [{"error": "Query must not be empty."}]

    kb_id = os.getenv("AWS_KNOWLEDGE_BASE_ID", "").strip()
    if not kb_id:
        return [{"error": "AWS_KNOWLEDGE_BASE_ID is not configured."}]

    region = os.getenv("AWS_KB_REGION")
    num_results = min(max(max_results, 1), 10)

    try:
        logger.info("Searching medical KB for query: %s", cleaned_query)
        bedrock_agent_runtime = boto3.client("bedrock-agent-runtime", region_name=region)
        response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=kb_id,
            retrievalQuery={"text": cleaned_query},
            retrievalConfiguration={
                "vectorSearchConfiguration": {"numberOfResults": num_results}
            },
        )

        results: List[Dict[str, Any]] = []
        for rank, item in enumerate(response.get("retrievalResults", []), 1):
            results.append(
                {
                    "rank": rank,
                    "content": item.get("content", {}).get("text", ""),
                    "score": item.get("score", 0.0),
                }
            )

        logger.info("Medical KB returned %d result(s)", len(results))
        return results
    except (ClientError, BotoCoreError) as exc:
        logger.exception("AWS error during medical KB retrieve")
        return [{"error": f"Failed to search knowledge base: {str(exc)}"}]
    except Exception as exc:  # pragma: no cover - safeguard for unknown runtime failures
        logger.exception("Unexpected error during medical KB retrieve")
        return [{"error": f"Failed to search knowledge base: {str(exc)}"}]


def format_kb_response(query: str, results: List[Dict[str, Any]]) -> str:
    if not results:
        return (
            "I could not find relevant information in the TTSH Library for this request. "
            "Please consult a licensed clinician for patient-specific advice."
        )

    first = results[0]
    if "error" in first:
        return str(first.get("error"))

    snippets: List[str] = []
    for result in results[:3]:
        text = str(result.get("content", "")).strip()
        if text:
            snippets.append(f"- {text}")

    if not snippets:
        return (
            "I could not find relevant information in the TTSH Library for this request. "
            "Please consult a licensed clinician for patient-specific advice."
        )

    joined = "\n".join(snippets)
    return (
        "Information retrieved from the TTSH Library:\n"
        f"{joined}\n\n"
        "Please consult a licensed clinician for diagnosis or urgent concerns."
    )
