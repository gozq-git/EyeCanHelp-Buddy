from bedrock_agentcore import BedrockAgentCoreApp
from dotenv import load_dotenv

from agent import create_agent


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
