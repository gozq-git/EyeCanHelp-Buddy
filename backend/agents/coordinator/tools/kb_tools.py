import logging
import os
from typing import Any, Dict, List

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


def _retrieve_kb(query: str, kb_id: str, region: str | None, max_results: int = 5) -> List[Dict[str, Any]]:
    """Shared Bedrock KB retrieval helper for specialist-specific knowledge bases."""
    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return [{"error": "Query must not be empty."}]

    cleaned_kb_id = (kb_id or "").strip()
    if not cleaned_kb_id:
        return [{"error": "Knowledge base ID is not configured."}]

    num_results = min(max(max_results, 1), 10)

    try:
        bedrock_agent_runtime = boto3.client("bedrock-agent-runtime", region_name=region)
        response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=cleaned_kb_id,
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

        return results
    except (ClientError, BotoCoreError) as exc:
        logger.exception("AWS error during KB retrieve")
        return [{"error": f"Failed to search knowledge base: {str(exc)}"}]
    except Exception as exc:  # pragma: no cover - safeguard for unknown runtime failures
        logger.exception("Unexpected error during KB retrieve")
        return [{"error": f"Failed to search knowledge base: {str(exc)}"}]


def search_medical_kb(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Search a medical knowledge base using semantic retrieval."""
    kb_id = os.getenv("AWS_KNOWLEDGE_BASE_ID", "").strip()
    if not kb_id:
        return [{"error": "AWS_KNOWLEDGE_BASE_ID is not configured."}]

    region = os.getenv("AWS_KB_REGION")
    logger.info("Searching medical KB for query: %s", (query or "").strip())
    results = _retrieve_kb(query, kb_id=kb_id, region=region, max_results=max_results)
    if not results or "error" not in results[0]:
        logger.info("Medical KB returned %d result(s)", len(results))
    return results


def search_financial_kb(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Search a financial knowledge base using semantic retrieval."""
    kb_id = os.getenv("AWS_FINANCIAL_KNOWLEDGE_BASE_ID", "").strip() or os.getenv(
        "AWS_KNOWLEDGE_BASE_ID", ""
    ).strip()
    if not kb_id:
        return [
            {
                "error": (
                    "AWS_FINANCIAL_KNOWLEDGE_BASE_ID is not configured "
                    "(and AWS_KNOWLEDGE_BASE_ID fallback is empty)."
                )
            }
        ]

    region = os.getenv("AWS_FINANCIAL_KB_REGION") or os.getenv("AWS_KB_REGION")
    logger.info("Searching financial KB for query: %s", (query or "").strip())
    results = _retrieve_kb(query, kb_id=kb_id, region=region, max_results=max_results)
    if not results or "error" not in results[0]:
        logger.info("Financial KB returned %d result(s)", len(results))
    return results


def format_kb_response(results: List[Dict[str, Any]]) -> str:
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


def format_financial_kb_response(results: List[Dict[str, Any]]) -> str:
    if not results:
        return (
            "I could not find relevant information for this request. "
            "Please verify details with your hospital billing team."
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
            "I could not find relevant information for this request. "
            "Please verify details with your hospital billing team."
        )

    joined = "\n".join(snippets)
    return (
        "Information retrieved:\n"
        f"{joined}\n\n"
        "Confirm eligibility rules and exact amounts with official billing and finance channels."
    )
