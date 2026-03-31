from bedrock_agentcore import BedrockAgentCoreApp

from agent import create_agent


app = BedrockAgentCoreApp()


@app.entrypoint
async def invoke(payload=None):
    try:
        query = payload.get("prompt", "Hello") if payload else "Hello"
        agent = create_agent()
        response = agent(query)
        return {
            "status": "success",
            "agent": "healthcare",
            "response": response.message["content"][0]["text"],
        }
    except Exception as exc:
        return {"status": "error", "agent": "healthcare", "error": str(exc)}


if __name__ == "__main__":
    app.run()
