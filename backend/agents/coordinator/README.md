# Coordinator Agent

Coordinator (orchestrator) runtime for the multi-agent system.

## Files

- `main.py`: AgentCore runtime entrypoint (`@app.entrypoint`)
- `agent.py`: Coordinator agent definition and system prompt
- `subagent_router.py`: AgentCore runtime invocation helper and routing methods
- `tools/routing_tools.py`: Tool functions exposed to the coordinator agent
- `tools/kb_tools.py`: Medical knowledge base search tool exposed to the coordinator agent
- `Dockerfile`: Container build for coordinator runtime
- `requirements.txt`: Coordinator dependencies

## Required Environment Variables

- `AWS_REGION`
- `FINANCIAL_AGENT_RUNTIME_ARN`
- `HEALTHCARE_AGENT_RUNTIME_ARN`
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
  -e FINANCIAL_AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:...:runtime/... \
  -e HEALTHCARE_AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:...:runtime/... \
  -e AWS_KNOWLEDGE_BASE_ID=kb-xxxxxxxxxx \
  eyecanhelp-coordinator:local
```
