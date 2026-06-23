# Agents

This folder follows the `02-use-cases` style used in `awslabs/agentcore-samples`.

## Structure

- `coordinator/`: Single runtime that routes requests internally to financial or healthcare logic.
  Implemented as a **microkernel (plug-in) pattern**:
  - `agent.py` — minimal core: escalation gate + triage + graph assembly from the registry.
  - `specialists/` — auto-discovered plug-ins (`base.py` contract, `registry.py`, `financial.py`, `healthcare.py`).
    Add a specialist by dropping a `<name>.py` here that subclasses `Specialist` and `@register`s — no core edit.
  - `llm.py` — shared Bedrock `converse` helper used by the core and the plug-ins.
  - `tools/kb_tools.py` — AWS Knowledge Base retrieval used by the healthcare plug-in.

## Runtime Roles

1. Coordinator Agent
- Entry point for user prompts
- Routes to financial or healthcare logic inside the same coordinator workflow
- Uses medical KB retrieval for healthcare responses

## Environment Variables

Set at minimum for coordinator runtime:

- `AWS_REGION`
- `AWS_KNOWLEDGE_BASE_ID`

## Run Locally

From `backend/`:

```powershell
python agents/coordinator/main.py
```
