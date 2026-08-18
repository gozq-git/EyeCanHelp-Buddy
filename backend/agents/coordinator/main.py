import logging
from importlib import import_module

from bedrock_agentcore import BedrockAgentCoreApp
from dotenv import load_dotenv

from agent import create_agent, get_specialist_by_name, route_request


logger = logging.getLogger(__name__)

# Initialize framework instrumentation before app/graph/client setup so
# LangGraph/LangChain operations can emit child spans into the active trace.
try:
    instrumentor = import_module("openinference.instrumentation.langchain").LangChainInstrumentor
    instrumentor().instrument()
except Exception as exc:
    logger.warning("LangChain instrumentation not enabled: %s", exc)


load_dotenv()


app = BedrockAgentCoreApp()
workflow = create_agent()


async def _stream_specialist_response(query: str):
    """Stream the routed specialist's tokens, or a single terminal message."""
    state = route_request(query)
    if state.get("route") in {"escalate", "out_of_scope"}:
        text = str(state.get("response", "")).strip()
        if text:
            yield text
        return

    route = str(state.get("route", "")).strip()
    specialist = get_specialist_by_name(route)
    if specialist is None:
        yield f"I could not find a specialist for route: {route or 'unknown'}"
        return

    for token in specialist.handle_stream(state):
        text = str(token)
        if text:
            yield text


@app.entrypoint
async def invoke(payload=None):
    try:
        query = payload.get("prompt", "Hello, what can you help me with?") if payload else "Hello"
        stream = bool(payload.get("stream", False)) if payload else False

        if stream:
            return _stream_specialist_response(query)

        response = workflow.invoke({"prompt": query})
        text = str(response.get("response", "")).strip()
        return {"status": "success", "agent": "coordinator", "response": text}
    except Exception as exc:
        return {"status": "error", "agent": "coordinator", "error": str(exc)}


if __name__ == "__main__":
    app.run()
