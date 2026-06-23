"""Financial specialist plug-in — Bedrock-only financial guidance."""
from llm import invoke_model
from specialists.base import CoordinatorState, Specialist
from specialists.registry import register

FINANCIAL_SYSTEM_PROMPT = """You are a Financial Specialist Agent.
Provide practical, conservative, and well-structured financial guidance.

Focus areas:
- Budgeting and expense planning
- Debt payoff strategies
- Emergency fund and savings planning
- Investment basics and portfolio allocation education
- Insurance and tax planning considerations

Always:
- State assumptions when data is missing.
- Highlight risks and tradeoffs.
- Avoid guaranteeing returns.
- End with a short action checklist.
"""


@register
class FinancialSpecialist(Specialist):
    name = "financial"
    description = "payment, medical cost, medisave, billing and budgeting questions."

    def handle(self, state: CoordinatorState) -> CoordinatorState:
        query = state.get("kb_query", state.get("prompt", ""))
        return {"response": invoke_model(FINANCIAL_SYSTEM_PROMPT, query)}
