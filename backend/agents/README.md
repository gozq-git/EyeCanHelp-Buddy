# Agents

This folder follows the `02-use-cases` style used in `awslabs/agentcore-samples`.

## Structure

- `coordinator/`: Orchestrates requests and routes to specialist runtimes
- `financial/`: Financial specialist agent runtime
- `healthcare/`: Healthcare specialist agent runtime

## Runtime Roles

1. Coordinator Agent
- Entry point for user prompts
- Uses routing tools to call specialist runtimes
- Synthesizes responses

2. Financial Agent
- Handles budgeting, debt planning, savings, and finance education

3. Healthcare Agent
- Handles health education and triage-oriented guidance

## Environment Variables

Set at minimum for coordinator runtime:

- `AWS_REGION`
- `FINANCIAL_AGENT_RUNTIME_ARN`
- `HEALTHCARE_AGENT_RUNTIME_ARN`

## Run Locally

From `backend/`:

```powershell
python agents/coordinator/main.py
python agents/financial/main.py
python agents/healthcare/main.py
```
