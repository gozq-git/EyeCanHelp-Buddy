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
                    │  SplashScreen → OnboardingScreen → ChatWindow        │
                    │                                                      │
                    │              ┌────────────────────┐                  │
                    │              │    ChatWindow.jsx   │                  │
                    │              │  ┌──────────────┐  │                  │
                    │              │  │ mode=welcome │  │ Quick-reply pills│
                    │              │  └──────┬───────┘  │                  │
                    │              │    ┌────┴──────────────────────┐      │
                    │              │    │                           │      │
                    │         ┌────▼────▼───┐  ┌──────────┐  ┌─────▼───┐  │
                    │         │  General    │  │   Pre-   │  │ Post-Op │  │
                    │         │  Enquiry    │  │Procedure │  │Checklist│  │
                    │         │  (LLM chat) │  │  (UC2)   │  │  (UC3)  │  │
                    │         └────┬────────┘  └────┬─────┘  └─────────┘  │
                    └──────────────┼───────────────┼───────────────────────┘
                                   │  HTTP/REST /api│
                    ┌──────────────▼───────────────▼──────────────────────┐
                    │        FastAPI Backend  (Python 3.12 · port 8000)    │
                    │                                                      │
                    │  POST /chat               (General Enquiry — LLM)   │
                    │  POST /acknowledgement    (Pre-Procedure — UC2)      │
                    │  POST /symptoms           (Post-Op Triage — UC3)     │
                    │  GET  /epic/patient/{id}          (EPIC Patient)     │
                    │  GET  /epic/patient/{id}/record   (EPIC Record)      │
                    └──────┬──────────┬──────────────┬─────────────────────┘
                           │          │              │
             ┌─────────────▼──┐  ┌────▼──────────┐  ┌───▼───────────────────┐
             │  EPIC (Mocked) │  │  AWS Bedrock  │  │      Databases        │
             │  FHIR R4       │  │  AgentCore    │  │                       │
             │  (future: real │  │  Coordinator  │  │  PostgreSQL           │
             │   EPIC API)    │  │  + Agents     │  │  ├─ TBL_PATIENT       │
             └────────────────┘  └───────────────┘  │  ├─ TBL_IVT          │
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
│   ├── Dockerfile                     # Node 20-alpine image, npm run dev port 3000
│   └── src/
│       ├── main.jsx                   # React root mount
│       ├── App.jsx                    # Screen state machine (splash→onboard→chat)
│       ├── api/
│       │   └── client.js              # Axios API client (all endpoints + simulateSingpassLogin)
│       └── components/
│           ├── SplashScreen.jsx       # Launch screen (blue bg, EyeCanHelp logo, 2s auto-advance)
│           ├── OnboardingScreen.jsx   # "You AI Assistant" intro + Continue button
│           ├── EyeLogoSVG.jsx         # Reusable eye-in-chat-bubble SVG (size prop)
│           ├── ChatWindow.jsx         # Conversational UI: mode + preProcStep + postOpStep state machines
│           ├── MessageBubble.jsx      # Multi-type bubble: text, welcome, singpass, docs
│           ├── SingpassLoginButton.jsx# Inline Singpass login (amber button, simulated)
│           ├── FinancialCounsellingDoc.jsx  # UC2: Inline financial counselling form render
│           ├── PostOpChecklistDoc.jsx       # UC3: Inline post-IVT advice form render
│           ├── EpicLookup.jsx              # (legacy — not rendered)
│           ├── AcknowledgementForm.jsx      # (legacy — not rendered)
│           └── SymptomChecker.jsx           # (legacy — not rendered)
│       └── __tests__/                     # Vitest test suite (80 tests, 7 files)
│           ├── setup.js                   # jest-dom matchers + scrollIntoView stub
│           ├── SplashScreen.test.jsx
│           ├── OnboardingScreen.test.jsx
│           ├── SingpassLoginButton.test.jsx
│           ├── PostOpChecklistDoc.test.jsx
│           ├── FinancialCounsellingDoc.test.jsx
│           ├── MessageBubble.test.jsx
│           └── ChatWindow.test.jsx        # Full state machine + API mock coverage
│
├── backend/                           # FastAPI Python API
│   ├── main.py                        # App entry point, router registration, DB lifespan
│   ├── requirements.txt               # fastapi, uvicorn, sqlalchemy, asyncpg, motor,
│   │                                  # anthropic, python-dotenv, boto3, httpx
│   ├── Dockerfile                     # FastAPI backend image (uvicorn, port 8000)
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
│   │   └── llm_service.py             # AWS Bedrock AgentCore invoke client
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
├── docker-compose.yml                 # Defines backend (port 8000) + frontend (port 3000) services
└── wbs/                               # Work Breakdown Structure docs
    ├── Chatbot_Proposal_Draft1.md
    ├── Architecture.md                # This file
    └── frontend_figma/                # UI reference screenshots (01_Load.png … 09_Onboarding.png)
```

---

## API Endpoints

| Method | Endpoint | Use Case | Description | Frontend triggered? |
|--------|----------|----------|-------------|---------------------|
| GET | `/epic/patient/{id}` | UC1 | Retrieve patient demographics (FHIR Patient) | No (backend only) |
| GET | `/epic/patient/{id}/record` | UC1 | Retrieve clinical record (FHIR DiagnosticReport) | No (backend only) |
| POST | `/acknowledgement` | UC2 | Submit patient acknowledgement + payment | Yes (ChatWindow UC2 flow) |
| POST | `/symptoms` | UC3 | Keyword-based symptom triage | No — PostOpChecklistDoc is static |
| POST | `/chat` | All | LLM chatbot conversation (AWS Bedrock AgentCore) | Yes (General Enquiry) |

Interactive docs: `http://localhost:8000/docs`

---

## Data Flow by Use Case

All use cases are driven through a single conversational `ChatWindow`. The app launches through a three-screen flow before reaching the chat.

### App Entry — Screen Flow
```
Browser opens http://localhost:3000
  → App.jsx: screen = 'splash'
  → SplashScreen.jsx auto-advances after 2 s → screen = 'onboarding'
  → OnboardingScreen.jsx: user taps "Continue" → screen = 'chat'
  → ChatWindow.jsx: mode = 'welcome'
       Renders welcome message + 4 quick-reply pills:
         • General Enquiry
         • Fill up pre-procedure
         • Fill up post-operation checklist
         • Return Menu
```

### General Enquiry — LLM Q&A
```
User taps "General Enquiry" pill  →  mode = 'general_enquiry'
  → Bot: "Sure, I can assist to answer general enquiries about eye procedures or surgery."

User types question (e.g. "What is a cataract?")
  → ChatWindow builds conversation history (text messages only)
  → POST /chat  { messages: [{ role, content }, ...] }
  → llm_service.py → _invoke_with_runtime_arn(prompt)
       → boto3 bedrock-agentcore.invoke_agent_runtime(
              agentRuntimeArn = AGENTCORE_COORDINATOR_RUNTIME_ARN,
              runtimeSessionId = uuid,
              payload = { "prompt": "USER: ...\nASSISTANT: ..." }
         )
       → Coordinator classifies domain → routes to Healthcare Agent
       → Healthcare Agent returns RAG answer (eye procedures/surgery)
  → Reply appended as bot text bubble in chat thread

User may continue multi-turn conversation or tap "Return Menu" to reset.
```

### UC2 — Pre-Procedure (Financial Counselling Form)
```
User taps "Fill up pre-procedure" pill  →  mode = 'pre_procedure', preProcStep = 'login'
  → Bot: "To proceed with the form, would you please sign in below?"
  → SingpassLoginButton renders inline in chat (amber button)

User taps Singpass Login (simulated, 600 ms delay)
  → simulateSingpassLogin() resolves { patient_id: 'P001' }
  → preProcStep = 'q_admission'
  → Bot asks 3 medical history questions one at a time:

    Q1: "Do you have any hospital admission in the last 3 months? Yes/No"
        User answers via chip (Yes/No) or free text
        Valid:   starts with 'y' or 'n'  →  formAnswers.last3mths_admission = true/false
        Invalid: bot re-asks Q1 ("Sorry, I didn't understand that. Please answer Yes or No.")
        preProcStep → 'q_stroke'

    Q2: "Any recent heart attack / stroke in last 6 months? Yes/No"
        User answers via chip (Yes/No) or free text
        Valid:   starts with 'y' or 'n'  →  formAnswers.stroke_heartAtt_last6mths = true/false
        Invalid: bot re-asks Q2
        preProcStep → 'q_eye'

    Q3: "IVT treatment is for right eye, left eye or both?"
        User answers via chip (Right/Left/Both) or free text
        Valid:   contains right/od, left/os, both/bilat/ou  →  formAnswers.record_eyes = OD | OS | OU
        Invalid: bot re-asks Q3 ("Sorry, I didn't understand that. Please answer Right, Left, or Both.")
        preProcStep → 'complete'

  → POST /acknowledgement  {
        patient_record: { patient_id, record_eyes, record_diagnosis: 'H35.31',
                          record_number_of_injections: 1, record_validity_of_consent: true,
                          record_last3mths_admission, record_stroke_heartAtt_last6mths,
                          record_taking_antibiotics: false, record_pregnant: false },
        payment: { payment_estCostPerInjection: 123, payment_mode: 'Medisave', ... }
    }
  → acknowledgement_service.py:
        • Saves PatientRecordCreate → MongoDB  TBL_PATIENT_RECORDS
            (auto-generates record_id = REC-P001-{6-hex}, issued = UTC now)
        • Saves Payment             → PostgreSQL  TBL_PAYMENT
  → Returns AcknowledgementResponse { record, payment, message }

  → ChatWindow renders FinancialCounsellingDoc inline:
        Title:    "OUTPATIENT PROCEDURES (INTRAVITREAL) — FINANCIAL COUNSELLING & ADVICE"
        Fields:   Surgeon · Date · MCR · Site (OD/OS/OU checkboxes) · Diagnosis (ICD-10)
        Procedure: 1B SL700V1A — Nurse-Led  |  Drug: Faricimab (Vabysmo)
        Bill:     $123 for 1 injection · Counselling language · Payment mode
        Footer:   Signature lines (Counselling Staff / Patient / Relationship)
```

### UC3 — Post-Operation Checklist
```
User taps "Fill up post-operation checklist" pill  →  mode = 'post_operation', postOpStep = 'login'
  → Bot: "To proceed with the checklist, would you please sign in below?"
  → SingpassLoginButton renders inline in chat (amber button)
  → Input bar disabled while waiting for login

User taps Singpass Login (simulated, 600 ms delay)
  → postOpStep = 'complete'
  → Bot: "Thanks for signing in. Here is your post-operation checklist."
  → ChatWindow renders PostOpChecklistDoc inline (no API call):

        Title:   "POST INTRAVITREAL INJECTION — Advice form (filled)"

        You have:
          [✓] Age-related macular degeneration

        Injection received:
          Faricimab · Right eye · <today's date>

        Normal side effects (black text):
          • Eye discomfort or mild eye pain
          • Superficial bleeding (subconjunctival haemorrhage)
          • Floaters (due to small air bubbles)

        Seek immediate attention if within 1 week (red text):
          • Increased eye pain / blurring of vision / eye redness
          • Light sensitivity
          • Numbness or weakness of limbs
          • Chest pain or chest tightness

        Contact info:
          Office hours   → call 9123 4567
          After hours    → walk in to Emergency Department (with this sheet)

  → Input bar remains disabled after checklist is displayed.
```

### Return Menu
```
User taps "Return Menu" pill (available in any mode)
  → mode        resets to 'welcome'
  → preProcStep resets to 'login'
  → postOpStep  resets to 'login'
  → formAnswers resets to defaults
  → New welcome message + quick-reply pills appended to chat thread
     (prior conversation history is preserved for context)
```

### Multi-Agent System — AWS Bedrock AgentCore
```
General Enquiry text  →  POST /chat  →  llm_service.py
  → _build_prompt(messages)  →  "USER: ...\nASSISTANT: ..."
  → _invoke_with_runtime_arn(prompt)
       → boto3.client("bedrock-agentcore").invoke_agent_runtime(
              agentRuntimeArn = AGENTCORE_COORDINATOR_RUNTIME_ARN,
              runtimeSessionId = AGENTCORE_RUNTIME_SESSION_ID or uuid4(),
              payload = JSON({ "prompt": transcript })
         )
  → Coordinator Agent classifies query domain:
         financial   →  invokes Financial Agent  (FINANCIAL_AGENT_RUNTIME_ARN)
                        handles: budgeting, Medisave limits, cost estimates, insurance
         healthcare  →  invokes Healthcare Agent  (HEALTHCARE_AGENT_RUNTIME_ARN)
                        handles: IVT procedure Q&A, medication education, symptom guidance
  → Specialist agent returns answer; Coordinator synthesises response
  → Response extracted from SSE stream / JSON body
  → reply string returned to POST /chat caller → appended as bot bubble
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
| record_validity_of_consent | bool | |
| record_last3mths_admission | bool | |
| record_stroke_heartAtt_last6mths | bool | |
| record_taking_antibiotics | bool | |
| record_pregnant | bool | |
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
| LLM | AWS Bedrock AgentCore | Coordinator routes to Financial / Healthcare agents; `anthropic==0.49.0` installed but not imported |
| Multi-agent | AWS Bedrock AgentCore + Strands | Coordinator + Financial + Healthcare runtimes |
| AWS SDK | boto3 1.39.0 | Bedrock runtime invocation |
| Containerization | Docker | One Dockerfile per agent runtime |
| CI/CD | GitHub Actions → AWS ECR | Automated build + push |
| Code quality | SonarQube + Snyk | Static analysis + security scanning |
| Frontend testing | Vitest 4 + React Testing Library | 80 tests across 7 files; runs in CI before build |

---

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `POSTGRES_URL` | FastAPI backend | PostgreSQL connection string (optional; default: `postgresql+asyncpg://user:password@localhost:5432/eyecanhelpbuddy`) |
| `MONGO_URL` | FastAPI backend | MongoDB connection string (optional; default: `mongodb://localhost:27017`) |
| `MONGO_DB` | FastAPI backend | MongoDB database name (optional; default: `eyecanhelpbuddy`) |
| `AWS_REGION` | FastAPI backend | AWS region for Bedrock (e.g. `us-east-1`) |
| `AWS_DEFAULT_REGION` | FastAPI backend | AWS SDK default region |
| `AGENTCORE_COORDINATOR_RUNTIME_ARN` | `llm_service.py` | ARN of the coordinator agent runtime |
| `AGENTCORE_COORDINATOR_ENDPOINT` | `llm_service.py` | Endpoint URL for coordinator runtime invocation |
| `AGENTCORE_TIMEOUT_SECONDS` | `llm_service.py` | HTTP timeout for AgentCore calls (default: `30`) |
| `AGENTCORE_RUNTIME_SESSION_ID` | `llm_service.py` | Optional fixed session ID; auto-generated (uuid4) if unset |
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
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload   # http://localhost:8000
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
