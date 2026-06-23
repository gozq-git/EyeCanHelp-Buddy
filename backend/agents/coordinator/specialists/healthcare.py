"""Healthcare specialist plug-in — RAG over the TTSH medical knowledge base."""
from llm import invoke_model
from specialists.base import CoordinatorState, Specialist
from specialists.registry import register
from tools.kb_tools import format_kb_response, search_medical_kb

HEALTHCARE_SYSTEM_PROMPT = """You are a Healthcare Specialist Agent.
You answer user healthcare questions using only retrieved information from the medical knowledge base.

Always:
- Base your answer on the provided KB snippets.
- Be concise, factual, and safe.
- If snippets are insufficient, say what is missing and advise seeing a licensed clinician.
- Do not invent facts that are not present in the snippets.
- If the snippets are relevant, always phrase the answer using the same phrasing as the snippets.
- If the snippets are not relevant, do not mention directly what was retrieved by the KB snippets.
- End with a short safety note for urgent symptoms.
"""

_NO_INFO = "No information available."


@register
class HealthcareSpecialist(Specialist):
    name = "healthcare"
    description = "symptoms, medical conditions, treatment, medication, clinical questions."

    def handle(self, state: CoordinatorState) -> CoordinatorState:
        query = state.get("kb_query", state.get("prompt", ""))
        results = search_medical_kb(query)
        if not results:
            return {"kb_results": [], "response": _NO_INFO}

        if any("error" in item for item in results if isinstance(item, dict)):
            return {"kb_results": results, "response": _NO_INFO}

        kb_context = format_kb_response(query, results)
        if not kb_context or "could not find relevant information" in kb_context.lower():
            return {"kb_results": results, "response": _NO_INFO}

        healthcare_prompt = (
            f"User query:\n{query}\n\n"
            "Retrieved medical knowledge base evidence:\n"
            f"{kb_context}\n\n"
            "Provide the best possible answer grounded only in the retrieved evidence."
        )
        answer = invoke_model(HEALTHCARE_SYSTEM_PROMPT, healthcare_prompt)
        if not answer.strip():
            return {"kb_results": results, "response": _NO_INFO}

        return {"kb_results": results, "response": answer}
