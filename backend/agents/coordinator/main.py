import logging
from importlib import import_module

from bedrock_agentcore import BedrockAgentCoreApp
from dotenv import load_dotenv

from agent import create_agent


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


@app.entrypoint
async def invoke(payload=None):
    try:
        query = payload.get("prompt", "Hello, what can you help me with?") if payload else "Hello"
        response = workflow.invoke({"prompt": query})
        text = str(response.get("response", "")).strip()
        return {"status": "success", "agent": "coordinator", "response": text}
    except Exception as exc:
        return {"status": "error", "agent": "coordinator", "error": str(exc)}


if __name__ == "__main__":
    app.run()
