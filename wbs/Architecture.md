# EyeCanHelp Buddy — System Architecture

## Overview

EyeCanHelp Buddy is a two-tier web application consisting of a React frontend (nurse/patient chatbot UI) and a FastAPI backend (LLM orchestration, EPIC integration, database persistence). The system assists IVT clinic nurses at a Singapore hospital to validate patient records, collect patient acknowledgements, and triage post-injection symptoms.

The backend also includes a multi-agent system (AWS Bedrock AgentCore) with a coordinator that routes to specialist financial and healthcare agents.

---

## High-Level Architecture

```
                    ┌──────────────────────────────────────────────────────┐
                    │         React Frontend  (Vite · port 3000)           │
                    │                                                      │
                    │  ┌─────────────┐  ┌──────────────────┐              │
                    │  │ EpicLookup  │  │AcknowledgementForm│              │
                    │  │   (UC1)     │  │      (UC2)        │              │
                    │  └──────┬──────┘  └────────┬──────────┘              │
                    │  ┌──────┴──────┐  ┌────────┴──────────┐              │
                    │  │SymptomChecker  │  │   ChatWindow     │              │
                    │  │   (UC3)     │  │  (LLM / All UCs)  │              │
                    │  └──────┬──────┘  └────────┬──────────┘              │
                    └─────────┼───────────────────┼──────────────────────┘
                              │   HTTP/REST /api   │
                    ┌─────────▼───────────────────▼──────────────────────┐
                    │        FastAPI Backend  (Python 3.12 · port 8000)   │
                    │                                                      │
                    │  GET  /epic/patient/{id}          (UC1 — Patient)   │
                    │  GET  /epic/patient/{id}/record   (UC1 — Record)    │
                    │  POST /acknowledgement            (UC2)             │
                    │  POST /symptoms                   (UC3)             │
                    │  POST /chat                       (LLM)             │
                    └──────┬──────────┬──────────────┬────────────────────┘
                           │          │              │
             ┌─────────────▼──┐  ┌────▼──────┐  ┌───▼───────────────────┐
             │  EPIC (Mocked) │  │ Anthropic │  │      Databases        │
             │  FHIR R4       │  │ Claude    │  │                       │
             │  (future: real │  │ Haiku 4.5 │  │  PostgreSQL           │
             │   EPIC API)    │  │           │  │  ├─ TBL_PATIENT       │
             └────────────────┘  └───────────┘  │  ├─ TBL_IVT          │
                                                │  └─ TBL_PAYMENT       │
                                                │                       │
                                                │  MongoDB              │
                                                │  └─ TBL_PATIENT_RECORDS│
                                                └───────────────────────┘

  ─ ─ ─ ─ ─ ─ ─ ─ ─  Separate System (AWS Bedrock AgentCore)  ─ ─ ─ ─ ─ ─

                    ┌───────────────────────────────────────────────────┐
                    │          Coordinator Agent  (port 8080)           │
                    │   Entry point · classifies query · synthesizes    │
                    └──────────────┬────────────────────────────────────┘
                                   │  invoke_runtime(ARN, query)
                     ┌─────────────┴──────────────┐
                     │                            │
           ┌─────────▼──────────┐    ┌────────────▼───────────┐
           │  Financial Agent   │    │  Healthcare Agent      │
           │  (port 8080)       │    │  (port 8080)           │
           │  Budgeting, debt,  │    │  Symptom guidance,     │
           │  savings, tax,     │    │  medication education, │
           │  insurance         │    │  preventive care       │
           └────────────────────┘    └────────────────────────┘
```

---

## Folder Structure

```
EyeCanHelp-Buddy/
├── frontend/                          # React chatbot UI (Vite)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js                 # Dev server port 3000, proxy /api → :8000
│   ├── .env.example
│   └── src/
│       ├── main.jsx                   # React root mount
│       ├── App.jsx                    # 4-tab navigation (UC1/UC2/UC3/Chat)
│       ├── api/
│       │   └── client.js              # Axios API client (all 5 endpoints)
│       └── components/
│           ├── EpicLookup.jsx         # UC1: EPIC patient + record lookup
│           ├── AcknowledgementForm.jsx# UC2: Acknowledgement + payment form
│           ├── SymptomChecker.jsx     # UC3: Post-injection symptom triage
│           ├── ChatWindow.jsx         # LLM multi-turn chat interface
│           └── MessageBubble.jsx      # Reusable message display component
│
├── backend/                           # FastAPI Python API
│   ├── main.py                        # App entry point, router registration, DB lifespan
│   ├── requirements.txt               # fastapi, uvicorn, sqlalchemy, asyncpg, motor,
│   │                                  # anthropic, python-dotenv, boto3
│   ├── Dockerfile                     # Coordinator agent image (legacy entry)
│   ├── .env.example
│   ├── database/
│   │   ├── postgres.py                # SQLAlchemy async engine + session
│   │   └── mongo.py                   # Motor async client (singleton)
│   ├── models/                        # SQLAlchemy ORM models (PostgreSQL)
│   │   ├── patient.py                 # TBL_PATIENT
│   │   ├── ivt.py                     # TBL_IVT
│   │   └── payment.py                 # TBL_PAYMENT
│   ├── schemas/                       # Pydantic schemas (FHIR R4-aligned)
│   │   ├── patient.py                 # resourceType: "Patient"
│   │   ├── patient_record.py          # resourceType: "DiagnosticReport"
│   │   ├── ivt.py                     # resourceType: "MedicationRequest"
│   │   └── payment.py                 # resourceType: "Coverage"
│   ├── routers/
│   │   ├── epic.py                    # GET /epic/patient/{id}
│   │   │                              # GET /epic/patient/{id}/record
│   │   ├── acknowledgement.py         # POST /acknowledgement
│   │   ├── symptom.py                 # POST /symptoms
│   │   └── chatbot.py                 # POST /chat
│   ├── services/
│   │   ├── epic_service.py            # Mock EPIC data (POC seed: P001, P002)
│   │   ├── acknowledgement_service.py # Mongo + Postgres write
│   │   ├── symptom_service.py         # Keyword-based triage (MILD/SEVERE/UNCLEAR)
│   │   └── llm_service.py             # AsyncAnthropic Claude Haiku 4.5 client
│   ├── agents/                        # AWS Bedrock AgentCore multi-agent system
│   │   ├── coordinator/               # Orchestrator — routes to specialist agents
│   │   │   ├── main.py               # AgentCore entrypoint (port 8080)
│   │   │   ├── agent.py              # Coordinator agent definition
│   │   │   ├── subagent_router.py    # Invokes specialist runtimes via ARN
│   │   │   ├── tools/
│   │   │   │   └── routing_tools.py  # call_financial_agent, call_healthcare_agent
│   │   │   ├── Dockerfile
│   │   │   └── requirements.txt      # boto3, bedrock-agentcore, strands-agents
│   │   ├── financial/                 # Financial specialist runtime
│   │   │   ├── main.py
│   │   │   ├── agent.py              # Budgeting, debt, savings, tax, insurance
│   │   │   ├── Dockerfile
│   │   │   └── requirements.txt      # bedrock-agentcore, strands-agents
│   │   └── healthcare/                # Healthcare specialist runtime
│   │       ├── main.py
│   │       ├── agent.py              # Symptom guidance, medication education
│   │       ├── Dockerfile
│   │       └── requirements.txt      # bedrock-agentcore, strands-agents
│   └── tests/
│       └── test_multi_agent.py        # Integration test: coordinator + specialists
│
└── wbs/                               # Work Breakdown Structure docs
    ├── Chatbot_Proposal_Draft1.md
    └── Architecture.md                # This file
```

---

## API Endpoints

| Method | Endpoint | Use Case | Description |
|--------|----------|----------|-------------|
| GET | `/epic/patient/{id}` | UC1 | Retrieve patient demographics (FHIR Patient) |
| GET | `/epic/patient/{id}/record` | UC1 | Retrieve clinical record (FHIR DiagnosticReport) |
| POST | `/acknowledgement` | UC2 | Submit patient acknowledgement + payment |
| POST | `/symptoms` | UC3 | Keyword-based symptom triage |
| POST | `/chat` | All | LLM chatbot conversation (Claude Haiku 4.5) |

Interactive docs: `http://localhost:8000/docs`

---

## Data Flow by Use Case

### UC1 — EPIC Clinical Check
```
Nurse opens "Patient Lookup" tab
  → EpicLookup.jsx calls GET /epic/patient/{id} + GET /epic/patient/{id}/record (parallel)
  → epic_service.py returns mock FHIR Patient + DiagnosticReport
  → UI displays: name, DOB, phone | diagnosis (ICD-10), target eye, injections, consent badge,
    medical history flags (admissions, stroke, antibiotics, pregnancy)
```

### UC2 — Patient Acknowledgement
```
Nurse/patient fills "Acknowledgement" tab form
  → AcknowledgementForm.jsx calls POST /acknowledgement
  → acknowledgement_service.py:
      • Saves PatientRecord → MongoDB (TBL_PATIENT_RECORDS)
      • Saves Payment       → PostgreSQL (TBL_PAYMENT)
  → UI displays confirmation: record_id + issued timestamp
```

### UC3 — Post-Injection Symptom Triage
```
Patient opens "Symptom Checker" tab
  → SymptomChecker.jsx calls POST /symptoms
  → symptom_service.py classifies: MILD | SEVERE | UNCLEAR (keyword matching)
  → UI displays severity badge + clinical advice
     SEVERE → go to A&E / call 995
     MILD   → monitor 24-48h, contact clinic if worsening
```

### Chat Assistant — LLM Interface
```
User opens "Chat Assistant" tab
  → ChatWindow.jsx sends full message history to POST /chat
  → llm_service.py calls Anthropic Claude Haiku 4.5 with IVT system prompt
  → Assistant responds contextually across all three use cases
```

### Multi-Agent System — AWS Bedrock AgentCore
```
External prompt → Coordinator Agent (port 8080)
  → Classifies query: financial or healthcare domain
  → SubAgentRouter.invoke_runtime(specialist_arn, query)
       Financial Agent → budgeting, debt, savings, tax, insurance guidance
       Healthcare Agent → symptom guidance, medication education, preventive care
  → Returns synthesized response
```

---

## Database Design

### PostgreSQL (structured, relational)

**TBL_PATIENT**
| Column | Type | Notes |
|--------|------|-------|
| patient_id | varchar(50) PK | Hashed NRIC |
| patient_name | varchar(255) | |
| patient_dob | varchar(20) | ISO date |
| phone_number | varchar(20) | |

**TBL_IVT**
| Column | Type | Notes |
|--------|------|-------|
| ivt_id | varchar(50) PK | |
| ivt_name | varchar(255) | |
| ivt_eyes | varchar(10) | OD / OS / OU |
| ivt_medication | varchar(255) | e.g. Eylea, Lucentis |

**TBL_PAYMENT**
| Column | Type | Notes |
|--------|------|-------|
| payment_id | varchar(50) PK | |
| payment_name | varchar(255) | |
| payment_diagnosis | varchar(50) | ICD-10 code |
| payment_maxMedisave | float | SGD |
| payment_estCostPerInjection | float | SGD |
| payment_mode | varchar(50) | Medisave / Cash / MediShield / CHAS |

### MongoDB (flexible, document-based)

**TBL_PATIENT_RECORDS**
| Field | Type | Notes |
|-------|------|-------|
| record_id | string | Auto-generated: REC-{patient_id}-{6-char-hex} |
| patient_id | string | FK to TBL_PATIENT |
| record_name | string | |
| record_diagnosis | string | ICD-10 (H35.31 AMD, H36.0 DME, H34.8 RVO) |
| record_eyes | string | OD / OS / OU |
| record_number_of_injections | int | |
| validity_of_consent | bool | |
| last3mths_admission | bool | |
| stroke_heartAtt_last6mths | bool | |
| taking_antibiotics | bool | |
| pregnant | bool | |
| issued | datetime | UTC timestamp |

---

## FHIR HL7 Strategy (POC vs Production)

Singapore's MOH healthcare ecosystem uses **FHIR R4** (HealthHub, NEHR). For this POC:

| Aspect | POC (now) | Production (future) |
|--------|-----------|---------------------|
| FHIR compliance | FHIR-aligned Pydantic models only | Full FHIR R4 server |
| EPIC integration | Mocked seed data (P001, P002) | Real EPIC FHIR R4 API |
| Code systems | ICD-10 strings in fields | Validated SNOMED/LOINC terminologies |
| Auth | None / API key | SMART on FHIR (OAuth2) |
| Singapore interop | Not connected | Connect to MOH NEHR / HealthHub |

All Pydantic schemas carry a `resourceType` field matching FHIR R4 resource names (`"Patient"`, `"DiagnosticReport"`, `"Coverage"`, `"MedicationRequest"`).

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite | Port 3000; /api proxy to :8000 |
| Backend | FastAPI (Python 3.12) | Port 8000; async throughout |
| ORM | SQLAlchemy 2 (async) | PostgreSQL async via asyncpg |
| MongoDB driver | Motor (async) | Non-blocking document storage |
| LLM | Anthropic Claude Haiku 4.5 | `claude-haiku-4-5-20251001`, max 512 tokens |
| Multi-agent | AWS Bedrock AgentCore + Strands | Coordinator + Financial + Healthcare runtimes |
| AWS SDK | boto3 1.39.0 | Bedrock runtime invocation |
| Containerization | Docker | One Dockerfile per agent runtime |
| CI/CD | GitHub Actions → AWS ECR | Automated build + push |
| Code quality | SonarQube + Snyk | Static analysis + security scanning |

---

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `POSTGRES_URL` | FastAPI backend | PostgreSQL connection string |
| `MONGO_URL` | FastAPI backend | MongoDB connection string |
| `MONGO_DB` | FastAPI backend | MongoDB database name |
| `ANTHROPIC_API_KEY` | FastAPI backend | Claude API key |
| `AWS_REGION` | Coordinator agent | AWS region for Bedrock |
| `FINANCIAL_AGENT_RUNTIME_ARN` | Coordinator agent | ARN of financial specialist runtime |
| `HEALTHCARE_AGENT_RUNTIME_ARN` | Coordinator agent | ARN of healthcare specialist runtime |

---

## Running Locally

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

### Multi-Agent Runtimes (AWS Bedrock AgentCore)
```bash
# Build Docker images from repo root
docker build -t eyecanhelp-coordinator:local -f backend/agents/coordinator/Dockerfile ./backend
docker build -t eyecanhelp-financial:local   -f backend/agents/financial/Dockerfile   ./backend
docker build -t eyecanhelp-healthcare:local  -f backend/agents/healthcare/Dockerfile  ./backend

# Or run locally (from backend/)
python agents/coordinator/main.py
python agents/financial/main.py
python agents/healthcare/main.py
```
