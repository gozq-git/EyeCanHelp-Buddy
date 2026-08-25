# Coordinator Agent

Orchestrator runtime for the multi-agent system.

## Architecture

Microkernel (plug-in) pattern. [agent.py](agent.py) is a minimal core owning only the
escalation safety gate, triage routing, and graph assembly — it never references a
specialist by name. Specialists under [specialists/](specialists/) are auto-discovered
plug-ins registered via `@register`.

## Files

- `main.py` — AgentCore entrypoint (`@app.entrypoint`)
- `agent.py` — core: escalation gate + triage + graph assembly
- `llm.py` — shared Bedrock `invoke_model` helper
- `specialists/` — plug-ins: `base.py` (contract), `registry.py`, `financial.py`, `healthcare.py`
- `tools/kb_tools.py` — knowledge base search
- `Dockerfile`, `requirements.txt`

## Environment

`AWS_REGION`, `AWS_KNOWLEDGE_BASE_ID`

## Run

```powershell
# Local, from backend/
python agents/coordinator/main.py

# Docker, from repo root
docker build -t eyecanhelp-coordinator:local -f backend/agents/coordinator/Dockerfile ./backend
docker run --rm -p 8080:8080 -e AWS_REGION=us-east-1 -e AWS_KNOWLEDGE_BASE_ID=kb-xxxxxxxxxx eyecanhelp-coordinator:local
```
