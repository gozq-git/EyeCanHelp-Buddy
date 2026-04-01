import os
import anthropic

_client: anthropic.AsyncAnthropic | None = None

SYSTEM_PROMPT = """You are EyeCanHelp Buddy, a helpful assistant for IVT (Intravitreal Injection) clinic nurses
at a Singapore hospital. You help nurses validate patient records, collect patient acknowledgements,
and triage post-injection symptoms.

Always be concise, professional, and accurate. If a patient reports severe eye symptoms
(floaters, flashes, severe pain, sudden vision loss), immediately advise them to go to A&E.

You operate in three modes:
1. EPIC CHECK — verifying patient diagnosis, target eye, injections, and consent from EPIC records
2. PATIENT ACKNOWLEDGEMENT — collecting identity, medical history flags, and payment confirmation
3. POST-INJECTION TRIAGE — assessing symptoms after IVT injection

Do not provide medical diagnoses. Route urgent cases to emergency services."""


def get_llm_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


async def chat(messages: list[dict]) -> str:
    client = get_llm_client()
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=messages,
    )
    return response.content[0].text
