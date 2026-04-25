from bedrock_agentcore import BedrockAgentCoreApp
from dotenv import load_dotenv

from agent import create_agent
from subagent_router import SubAgentRouter


load_dotenv()


app = BedrockAgentCoreApp()


@app.entrypoint
async def invoke(payload=None):
    try:
        query = payload.get("prompt", "Hello, what can you help me with?") if payload else "Hello"
        router = SubAgentRouter()
        agent = create_agent(router)
        response = agent(query)
        text = response.message["content"][0]["text"]
        return {"status": "success", "agent": "coordinator", "response": text}
    except Exception as exc:
        return {"status": "error", "agent": "coordinator", "error": str(exc)}


if __name__ == "__main__":
    app.run()
