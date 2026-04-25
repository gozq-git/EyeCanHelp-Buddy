from strands import Agent

from tools import get_kb_tools, get_routing_tools


def create_agent(router) -> Agent:
    system_prompt = """You are an orchestrator agent.
You coordinate between two specialist agents and synthesize clear responses.

Use search_medical_kb when the user asks for factual medical information that should be looked up from the configured medical knowledge base.

For healthcare content, include a brief reminder to consult a licensed clinician for diagnosis or urgent concerns.
"""
    tools = get_kb_tools()
    return Agent(tools=tools, system_prompt=system_prompt, name="CoordinatorAgent")
