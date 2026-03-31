# Healthcare Agent

Healthcare specialist runtime.

## Files

- `main.py`: AgentCore runtime entrypoint (`@app.entrypoint`)
- `agent.py`: Healthcare specialist agent definition
- `Dockerfile`: Container build for healthcare runtime
- `requirements.txt`: Healthcare runtime dependencies

## Run Locally

From `backend/`:

```powershell
python agents/healthcare/main.py
```

## Docker

From repo root:

```powershell
docker build -t eyecanhelp-healthcare:local -f backend/agents/healthcare/Dockerfile ./backend
```
