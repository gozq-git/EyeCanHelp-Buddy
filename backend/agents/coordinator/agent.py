from strands import Agent

from tools import get_routing_tools


def create_agent(router) -> Agent:
    system_prompt = """You are an orchestrator agent.
You coordinate between two specialist agents and synthesize clear responses.

Use call_financial_agent when the user asks about:
- budgets, debt, spending, savings, investing, taxes, banking, insurance, or money planning.

Use call_healthcare_agent when the user asks about:
- symptoms, medications, treatment options, wellness, preventive care, or medical guidance.

If a query spans both domains, call both tools and combine the outputs into one practical response.
For healthcare content, include a brief reminder to consult a licensed clinician for diagnosis or urgent concerns.
"""
    tools = get_routing_tools(router)
    return Agent(tools=tools, system_prompt=system_prompt, name="CoordinatorAgent")
