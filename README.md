# EyeCanHelp Buddy

## Backend (FastAPI Hello World)

The backend lives in [backend](backend) and exposes a simple hello-world API.

### Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` and you should see:

```json
{"message":"Hello, World!"}
```

## Docker

Build and run from repo root:

```powershell
docker build -t eyecanhelp-buddy-backend:local ./backend
docker run --rm -p 8000:8000 eyecanhelp-buddy-backend:local
```

## GitHub Actions -> AWS ECR

Workflow file: [.github/workflows/build-and-push-ecr.yml](.github/workflows/build-and-push-ecr.yml)

Behavior:
- Triggers on `push` to `main`
- Builds Docker image from [backend](backend)
- Pushes two tags to ECR: `<commit-sha>` and `latest`

### Required GitHub Secrets

Add these in your GitHub repository settings:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Placeholder values to replace

In [.github/workflows/build-and-push-ecr.yml](.github/workflows/build-and-push-ecr.yml), replace:

- `YOUR_AWS_REGION`
- `YOUR_AWS_ACCOUNT_ID`
- `YOUR_ECR_REPOSITORY`

Example ECR image URI after replacement:

`<account-id>.dkr.ecr.<region>.amazonaws.com/<repository>:<tag>`