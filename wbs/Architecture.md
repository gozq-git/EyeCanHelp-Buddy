# EyeCanHelp Buddy — System Architecture

## Overview

EyeCanHelp Buddy is a two-tier web application consisting of a React frontend (nurse/patient chatbot UI) and a FastAPI backend (LLM orchestration, EPIC integration, database persistence). The system assists IVT clinic nurses at a Singapore hospital to validate patient records, collect patient acknowledgements, and triage post-injection symptoms.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              React Frontend (Vite)                      │   │
│   │  - Chatbot UI (nurse + patient views)                   │   │
│   │  - UC1: EPIC record display                             │   │
│   │  - UC2: Acknowledgement form                            │   │
│   │  - UC3: Post-injection symptom checker                  │   │
│   └────────────────────────┬────────────────────────────────┘   │
└────────────────────────────│────────────────────────────────────┘
                             │ HTTP/REST (JSON)
┌────────────────────────────▼────────────────────────────────────┐
│                       API Layer                                 │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              FastAPI Backend (Python)                   │   │
│   │                                                         │   │
│   │  ┌────────────┐  ┌──────────────────┐  ┌────────────┐  │   │
│   │  │ /epic      │  │ /acknowledgement │  │ /symptoms  │  │   │
│   │  │ (UC1)      │  │ (UC2)            │  │ (UC3)      │  │   │
│   │  └─────┬──────┘  └────────┬─────────┘  └─────┬──────┘  │   │
│   │        │                  │                   │         │   │
│   │        └──────────────────▼───────────────────┘         │   │
│   │                    ┌──────────┐                         │   │
│   │                    │ /chat    │                         │   │
│   │                    │ (LLM)    │                         │   │
│   │                    └──────────┘                         │   │
│   └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                    │               │              │
       ┌────────────▼──┐  ┌─────────▼────┐  ┌────▼────────────┐
       │  EPIC (Mock)  │  │  Anthropic   │  │  Databases      │
       │  FHIR R4      │  │  Claude API  │  │                 │
       │  (Future:     │  │  (Haiku 4.5) │  │  ┌───────────┐  │
       │   real EPIC)  │  └──────────────┘  │  │PostgreSQL │  │
       └───────────────┘                    │  │TBL_PATIENT│  │
                                            │  │TBL_IVT    │  │
                                            │  │TBL_PAYMENT│  │
                                            │  └───────────┘  │
                                            │  ┌───────────┐  │
                                            │  │ MongoDB   │  │
                                            │  │TBL_PATIENT│  │
                                            │  │_RECORDS   │  │
                                            │  └───────────┘  │
                                            └─────────────────┘
```

---

## Folder Structure

```
EyeCanHelp-Buddy/
├── frontend/                          # React chatbot UI
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js              # Axios API calls to backend
│       └── components/
│           ├── ChatWindow.jsx         # Main chat interface
│           ├── MessageBubble.jsx      # Individual message display
│           └── SymptomChecker.jsx     # UC3 symptom form
│
├── backend/                           # FastAPI Python API
│   ├── main.py                        # App entry point, router registration
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── database/
│   │   ├── postgres.py                # SQLAlchemy async engine
│   │   └── mongo.py                   # Motor async client
│   ├── models/                        # SQLAlchemy ORM models (PostgreSQL)
│   │   ├── patient.py                 # TBL_PATIENT
│   │   ├── ivt.py                     # TBL_IVT
│   │   └── payment.py                 # TBL_PAYMENT
│   ├── schemas/                       # Pydantic schemas (FHIR-aligned)
│   │   ├── patient.py                 # resourceType: "Patient"
│   │   ├── patient_record.py          # resourceType: "DiagnosticReport"
│   │   ├── ivt.py                     # resourceType: "MedicationRequest"
│   │   └── payment.py                 # resourceType: "Coverage"
│   ├── routers/
│   │   ├── epic.py                    # GET /epic/patient/{id}
│   │   ├── acknowledgement.py         # POST /acknowledgement
│   │   ├── symptom.py                 # POST /symptoms
│   │   └── chatbot.py                 # POST /chat
│   └── services/
│       ├── epic_service.py            # Mock EPIC data (POC)
│       ├── acknowledgement_service.py # Mongo + Postgres write
│       ├── symptom_service.py         # Keyword triage logic
│       └── llm_service.py             # Anthropic Claude calls
│
└── wbs/                               # Work Breakdown Structure docs
    ├── Chatbot_Proposal_Draft1.md
    └── Architecture.md                # This file
```

---

## API Endpoints

| Method | Endpoint | Use Case | Description |
|--------|----------|----------|-------------|
| GET | `/epic/patient/{id}` | UC1 | Retrieve patient demographics from EPIC |
| GET | `/epic/patient/{id}/record` | UC1 | Retrieve clinical record (diagnosis, consent, injections) |
| POST | `/acknowledgement` | UC2 | Submit patient acknowledgement + payment |
| POST | `/symptoms` | UC3 | Triage post-injection symptoms |
| POST | `/chat` | All | LLM chatbot conversation endpoint |

Interactive docs available at `http://localhost:8000/docs` (Swagger UI).

---

## Data Flow by Use Case

### UC1 — EPIC Clinical Check
```
Nurse opens app
  → Frontend calls GET /epic/patient/{id}/record
  → epic_service.py returns mock FHIR DiagnosticReport
  → Nurse reviews: diagnosis, target eye, injections, consent validity
```

### UC2 — Patient Acknowledgement
```
Nurse/Patient fills acknowledgement form
  → Frontend calls POST /acknowledgement
  → acknowledgement_service.py:
      • Saves PatientRecord → MongoDB (TBL_PATIENT_RECORDS)
      • Saves Payment       → PostgreSQL (TBL_PAYMENT)
  → Returns confirmation + payment estimate
```

### UC3 — Post-Injection Symptom Triage
```
Patient describes symptoms in chat
  → Frontend calls POST /symptoms  (keyword triage)
     OR POST /chat  (LLM-based triage)
  → symptom_service.py classifies: mild | severe | unclear
  → If SEVERE: advise patient to go to A&E / call 995
  → If MILD: monitor, contact clinic if worsening
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
| record_id | string | Auto-generated |
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
| EPIC integration | Mocked seed data | Real EPIC FHIR R4 API |
| Code systems | ICD-10 strings in fields | Validated SNOMED/LOINC terminologies |
| Auth | None / API key | SMART on FHIR (OAuth2) |
| Singapore interop | Not connected | Connect to MOH NEHR / HealthHub |

All Pydantic schemas carry a `resourceType` field matching the FHIR R4 resource name (e.g. `"DiagnosticReport"`, `"Patient"`, `"Coverage"`). This ensures future migration is a structural lift-and-shift.

---

## Technology Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React 18 + Vite | Fast dev server, component-based chat UI |
| Backend | FastAPI (Python 3.12) | Async, auto-docs, Pydantic validation |
| ORM | SQLAlchemy 2 (async) | PostgreSQL async access |
| MongoDB driver | Motor (async) | Non-blocking MongoDB for flexible records |
| LLM | Anthropic Claude Haiku 4.5 | Cost-efficient for POC chatbot |
| Containerization | Docker | Consistent deployment |
| CI/CD | GitHub Actions → AWS ECR | Automated build + push |
| Code quality | SonarQube + Snyk | Static analysis + security scanning |
