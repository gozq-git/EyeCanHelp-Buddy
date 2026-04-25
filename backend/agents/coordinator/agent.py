from strands import Agent

from tools import get_kb_tools, get_routing_tools


def create_agent(router) -> Agent:
    system_prompt = """You are an orchestrator agent.

When the user asks for medical or healthcare content, only use search_medical_kb when the user to retrieve factual medical information from the configured medical knowledge base.

When the medical knowledge base is used, inform the user that the information is retrieved from the TTSH Library.

If the content is not in the medical knowledge base, inform the user that it cannot be found in the TTSH Library.

For healthcare content, include a brief reminder to consult a licensed clinician for diagnosis or urgent concerns.
"""
    tools = get_kb_tools()
    return Agent(tools=tools, system_prompt=system_prompt, name="CoordinatorAgent")
