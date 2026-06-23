# Coordinator Agent

Coordinator (orchestrator) runtime for the multi-agent system.

## Architecture — Microkernel (Plug-in) pattern

`agent.py` is a minimal **core** that owns only the escalation safety gate, triage
routing, and graph assembly. It builds the LangGraph by iterating the specialist
**registry** — it never references a specialist by name. Specialists are **plug-ins**
under `specialists/`, auto-discovered at import.

**Add a specialist with zero core edits:** create `specialists/<name>.py`:

```python
from llm import invoke_model
from specialists.base import CoordinatorState, Specialist
from specialists.registry import register

@register
class MySpecialist(Specialist):
    name = "appointments"                      # triage label + graph node name
    description = "booking, rescheduling, clinic visit times."  # fed into triage prompt
    def handle(self, state: CoordinatorState) -> CoordinatorState:
        return {"response": invoke_model("You are ...", state.get("kb_query", ""))}
```

It is discovered, added as a graph node, given a triage label, and wired with a
conditional edge automatically.

## Files

- `main.py`: AgentCore runtime entrypoint (`@app.entrypoint`)
- `agent.py`: Microkernel core — escalation gate + triage + graph assembly from the registry
- `llm.py`: Shared Bedrock `converse` helper (`invoke_model`) + transcript parsing
- `specialists/`: Plug-in package
  - `base.py`: `Specialist` contract + `CoordinatorState`
  - `registry.py`: `@register` + `get_specialists()`
  - `__init__.py`: `pkgutil` auto-discovery of plug-in modules
  - `financial.py`, `healthcare.py`: the bundled specialist plug-ins
- `tools/kb_tools.py`: Medical knowledge base search tool used by the healthcare plug-in
- `Dockerfile`: Container build for coordinator runtime
- `requirements.txt`: Coordinator dependencies

## Required Environment Variables

- `AWS_REGION`
- `AWS_KNOWLEDGE_BASE_ID`

## Run Locally

From `backend/`:

```powershell
python agents/coordinator/main.py
```

## Docker

From repo root:

```powershell
docker build -t eyecanhelp-coordinator:local -f backend/agents/coordinator/Dockerfile ./backend
```

Run:

```powershell
docker run --rm -p 8080:8080 \
  -e AWS_REGION=us-east-1 \
  -e AWS_KNOWLEDGE_BASE_ID=kb-xxxxxxxxxx \
  eyecanhelp-coordinator:local
```
