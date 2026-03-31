# Financial Agent

Financial specialist runtime.

## Files

- `main.py`: AgentCore runtime entrypoint (`@app.entrypoint`)
- `agent.py`: Financial specialist agent definition
- `Dockerfile`: Container build for financial runtime
- `requirements.txt`: Financial runtime dependencies

## Run Locally

From `backend/`:

```powershell
python agents/financial/main.py
```

## Docker

From repo root:

```powershell
docker build -t eyecanhelp-financial:local -f backend/agents/financial/Dockerfile ./backend
```
