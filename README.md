# EyeCanHelp Buddy

## Backend (02-use-cases Style Multi-Agent Structure)

The backend in [backend](backend) now follows the 02-use-cases layout conventions from `awslabs/agentcore-samples` with an `agents/` root and per-agent packages.

Detailed package docs:
- [backend/agents/README.md](backend/agents/README.md)
- [backend/agents/coordinator/README.md](backend/agents/coordinator/README.md)
- [backend/agents/financial/README.md](backend/agents/financial/README.md)
- [backend/agents/healthcare/README.md](backend/agents/healthcare/README.md)
- [backend/tests/README.md](backend/tests/README.md)

### Project structure

```text
backend/
├── agents/
│   ├── coordinator/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── agent.py
│   │   ├── subagent_router.py
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   └── routing_tools.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── financial/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── agent.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── healthcare/
│       ├── __init__.py
│       ├── main.py
│       ├── agent.py
│       ├── Dockerfile
│       └── requirements.txt
├── tests/
│   └── test_multi_agent.py
├── requirements.txt
└── .env.example
```

The coordinator delegates to specialists through `bedrock-agentcore:InvokeAgentRuntime`, matching the multi-agent runtime examples in [awslabs/agentcore-samples](https://github.com/awslabs/agentcore-samples).

### Required AWS setup

Set these environment variables before running the coordinator runtime:

```powershell
$env:AWS_REGION="us-east-1"
$env:FINANCIAL_AGENT_RUNTIME_ARN="arn:aws:bedrock-agentcore:...:runtime/..."
$env:HEALTHCARE_AGENT_RUNTIME_ARN="arn:aws:bedrock-agentcore:...:runtime/..."
```

Your AWS credentials need permission to invoke both specialist runtimes.

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

### Runtime entrypoints

Coordinator runtime:

```powershell
python agents/coordinator/main.py
```

Financial specialist runtime:

```powershell
python agents/financial/main.py
```

Healthcare specialist runtime:

```powershell
python agents/healthcare/main.py
```

Each runtime expects a payload containing `prompt`, for example:

```json
{
  "prompt": "Build me a debt payoff plan using the avalanche method."
}
```

## Docker

Build and run each runtime from repo root (sample-style per-agent Dockerfiles):

```powershell
docker build -t eyecanhelp-coordinator:local -f backend/agents/coordinator/Dockerfile ./backend
docker build -t eyecanhelp-financial:local -f backend/agents/financial/Dockerfile ./backend
docker build -t eyecanhelp-healthcare:local -f backend/agents/healthcare/Dockerfile ./backend

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