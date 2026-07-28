# EyeCanHelp Buddy

## Backend

The backend in [backend](backend) now has two aligned parts:

- A FastAPI application with service-isolated domains under [backend/services](backend/services)
- An AgentCore coordinator runtime under [backend/agents/coordinator](backend/agents/coordinator)
- A direct notifications pipeline for appointment confirmation:
  backend API sends email via Gmail API

Detailed package docs:
- [backend/agents/README.md](backend/agents/README.md)
- [backend/agents/coordinator/README.md](backend/agents/coordinator/README.md)
- [backend/tests/README.md](backend/tests/README.md)

### Project structure

```text
backend/
├── main.py
├── database/
├── services/
│   ├── billing/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── model.py
│   │   └── schema.py
│   ├── patient/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── model.py
│   │   └── schema.py
│   └── chatbot/
│       ├── router.py                # /chat and /acknowledgement endpoints
│       ├── service.py               # chat + acknowledgement persistence logic
│       ├── llm.py                   # AgentCore runtime invocation client
│       ├── model.py
│       └── schema.py
│   └── notifications/
│       ├── router.py                # /notifications/appointments endpoint
│       ├── service.py               # Gmail payload mapping + send
│       └── schema.py
├── agents/
│   ├── coordinator/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── agent.py
│   │   ├── llm.py
│   │   ├── specialists/
│   │   ├── tools/
│   │   │   └── kb_tools.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
├── tests/
│   └── test_multi_agent.py
├── requirements.txt
└── .env.example
```

The coordinator delegates to specialists through `bedrock-agentcore:InvokeAgentRuntime`, matching the multi-agent runtime examples in [awslabs/agentcore-samples](https://github.com/awslabs/agentcore-samples).

### Run FastAPI backend locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Required AWS setup

Set these environment variables before running the coordinator runtime:

```powershell
$env:AWS_REGION="us-east-1"
$env:FINANCIAL_AGENT_RUNTIME_ARN="arn:aws:bedrock-agentcore:...:runtime/..."
$env:HEALTHCARE_AGENT_RUNTIME_ARN="arn:aws:bedrock-agentcore:...:runtime/..."
```

Your AWS credentials need permission to invoke both specialist runtimes.

For appointment notification emails (direct backend send), set Gmail OAuth2
credentials and sender vars in `backend/.env`.

You can copy [backend/.env.example](backend/.env.example) as a starting point.

### Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python agents/coordinator/main.py
```

The runtime exposes AgentCore-compatible endpoints (for example `/invocations`) on port `8080`.

### Appointment notification pipeline (Backend -> Gmail API)

- Endpoint: `POST /api/notifications/appointments`
- Behavior: validates appointment notification payload and sends email directly through Gmail API

Required environment variables are listed in [backend/.env.example](backend/.env.example).

### Agent runtime entrypoints

Coordinator runtime:

```powershell
python agents/coordinator/main.py
```

Each runtime expects a payload containing `prompt`, for example:

```json
{
  "prompt": "Build me a debt payoff plan using the avalanche method."
}
```

## Docker

Build and run the coordinator runtime from repo root:

```powershell
docker build -t eyecanhelp-coordinator:local -f backend/agents/coordinator/Dockerfile ./backend

# Coordinator (requires specialist runtime ARNs)
docker run --rm -p 8080:8080 \
  -e AWS_REGION=us-east-1 \
  -e FINANCIAL_AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:...:runtime/... \
  -e HEALTHCARE_AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:...:runtime/... \
  eyecanhelp-coordinator:local
```

## Testing

Sample-style runtime test script is available at [backend/tests/test_multi_agent.py](backend/tests/test_multi_agent.py).

Run:

```powershell
cd backend
python tests/test_multi_agent.py <coordinator_runtime_arn> <financial_runtime_arn> <healthcare_runtime_arn>
```

## GitHub Actions -> AWS ECR

Workflow file: [.github/workflows/build-and-push-ecr.yml](.github/workflows/build-and-push-ecr.yml)

Behavior:
- Triggers on `push` to `main`
- Builds Docker image from [backend](backend)
- Pushes two tags to ECR: `<commit-sha>` and `latest`