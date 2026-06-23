
# EyeCanHelp Buddy — System Architecture

## Overview

EyeCanHelp Buddy is a two-tier web application consisting of a React frontend (nurse/patient chatbot UI) and a FastAPI backend (LLM orchestration, EPIC integration, database persistence). The system assists IVT clinic nurses at a Singapore hospital to validate patient records, collect patient acknowledgements, and triage post-injection symptoms.

The backend also includes a multi-agent system (AWS Bedrock AgentCore) with a coordinator that routes to specialist financial and healthcare agents.

---

## Design Patterns

The system deliberately applies three patterns. Each is summarised here and detailed in the sections referenced.

### 1. Facade Pattern (structural)

A facade exposes a simple, stable interface over a complex or volatile subsystem.

| Facade | File | Hides |
|--------|------|-------|
| **EPIC service** (primary) | `backend/services/epic_service.py` | That "EPIC" is two stores — PostgreSQL `TBL_PATIENT` + MongoDB `TBL_PATIENT_RECORDS`. Callers use `get_patient_from_epic()` / `get_patient_record_from_epic()` and never touch SQLAlchemy or Motor. Swapping to the real EPIC FHIR R4 API changes only this file. |
| **LLM service** | `backend/services/llm_service.py` | AgentCore invocation detail — ARN region parsing, boto3 client, payload encoding, event-stream vs JSON response parsing. Caller just calls `chat(messages)`. |
| **API client** | `frontend/src/api/client.js` | axios setup, `baseURL`, headers, endpoint paths. Components call `getEpicPatient()`, `submitAcknowledgement()`, etc. |

### 2. Microkernel (Plug-in) Pattern (architectural)

The coordinator is a **minimal, stable core** that knows nothing about individual specialists; each specialist is a self-contained **plug-in** discovered at startup.

- **Core (microkernel):** `backend/agents/coordinator/agent.py` — owns only the escalation safety gate, triage routing, and graph assembly. It builds the graph by *iterating the registry*; it never names a specialist explicitly.
- **Plug-in contract:** `specialists/base.py` — `Specialist` (`name`, `description`, `handle(state)`).
- **Registry:** `specialists/registry.py` — `@register` decorator + `get_specialists()`.
- **Discovery:** `specialists/__init__.py` — `pkgutil` imports every module in the package, so each plug-in's `register(...)` runs automatically.
- **Plug-ins:** `specialists/financial.py`, `specialists/healthcare.py`.

> **Extensibility guarantee:** adding a specialist = drop a `<name>.py` into `specialists/` that subclasses `Specialist` and `@register`s. A new graph node, a new triage label (from its `description`), and a new conditional edge are wired automatically. **The core (`agent.py`) is never edited.** The triage prompt is built dynamically from the registered plug-ins' descriptions.

### 3. Behavioral Pattern — LangGraph Orchestrator (behavioral)

Runtime control flow is data-driven by `CoordinatorState`, a behavioral (State/Strategy-style) orchestration via a LangGraph `StateGraph`:

```
escalate ──(escalate)──▶ END                       # urgent → hotline reply
   └──────(triage)─────▶ llm_triage ──(financial)─▶ financial ─▶ END
                                  └───(healthcare)─▶ healthcare ─▶ END
```

Conditional edges (`_escalation_route_edge`, `_triage_route_edge`) select the next node from state at runtime. See **Multi-Agent System — AWS Bedrock AgentCore** below for the full node-by-node flow.

### Ownership (3-person team)

| Person | Role | Owns (patterns) |
|--------|------|-----------------|
| Person 1 | Figma & Requirements | Keeps this document in sync with the code |
| Person 2 | Frontend & Backend CRUD (Application Assembler) | **Facade** — `api/client.js`, thin routers over services |
| Person 3 | AI & Infrastructure Engineer | **Microkernel** (`specialists/`) + **LangGraph Orchestrator** (`agent.py`) |

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
             ┌─────────────▼──┐  ┌────▼──────────┐  ┌───▼─────────────────────┐
             │  EPIC façade   │  │  AWS Bedrock  │  │       Databases         │
             │  FHIR R4       │  │  AgentCore    │  │                         │
             │  (reads local  │  │  Coordinator  │  │  PostgreSQL             │
             │   DBs in POC;  │  │  + Agents     │  │  ├─ TBL_PATIENT         │
             │   real EPIC    │  │               │  │  ├─ TBL_IVT             │
             │   API in prod) │  │               │  │  └─ TBL_PAYMENT         │
             └────────┬───────┘  └───────────────┘  │                         │
                      │                              │  MongoDB                │
                      └──────────────────────────────▶  └─ TBL_PATIENT_RECORDS │
                                                     │     (REC-{id}-001 seeds │
                                                     │      represent EPIC's   │
                                                     │      canonical record)  │
                                                     └─────────────────────────┘

  ─ ─ ─ ─ ─ ─ ─ ─ ─  Separate System (AWS Bedrock AgentCore)  ─ ─ ─ ─ ─ ─

                    ┌──────────────────────────────────────────────────────────┐
                    │       Coordinator Agent  (microkernel · port 8080)       │
                    │                                                          │
                    │   LangGraph StateGraph (in-process — no cross-runtime)   │
                    │                                                          │
                    │   ┌────────────────────────────────────────────────┐     │
                    │   │  escalate  (entry · clinical safety gate)      │     │
                    │   │  keywords + Bedrock ESCALATION_REVIEW_PROMPT   │     │
                    │   └──────────┬──────────────────────────┬──────────┘     │
                    │   escalate → END                  triage │                │
                    │   (urgent hotline reply)                 ▼                │
                    │   ┌────────────────────────────────────────────────┐     │
                    │   │  llm_triage  (Bedrock converse — TRIAGE_PROMPT │     │
                    │   │  built dynamically from plug-in descriptions)  │     │
                    │   └───────────────┬──────────────┬───────────────┘       │
                    │                   │              │                        │
                    │            ┌──────▼──────┐ ┌─────▼────────┐               │
                    │            │  financial  │ │  healthcare  │  ← Specialist │
                    │            │  Bedrock    │ │  KB RAG +    │    plug-ins   │
                    │            │  converse   │ │  Bedrock     │  (registry-   │
                    │            └──────┬──────┘ └─────┬────────┘    driven)    │
                    │                   └─────────────┘                         │
                    │                          │  END                          │
                    └──────────────────────────┼─────────────────────────────┘
                                                  │  KB lookups only
                                                  ▼
                    ┌──────────────────────────────────────────────────────────┐
                    │       AWS Knowledge Base  (TTSH Library docs)            │
                    │       AWS_KNOWLEDGE_BASE_ID · AWS_KB_REGION              │
                    └──────────────────────────────────────────────────────────┘
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
│       ├── App.jsx                    # Screen state machine (splash→onboard→chat); passes onBack to ChatWindow (chat→onboard)
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
│       └── __tests__/                     # Vitest test suite (90 tests, 7 files)
│           ├── setup.js                   # jest-dom matchers + scrollIntoView stub
│           ├── SplashScreen.test.jsx
│           ├── OnboardingScreen.test.jsx
│           ├── SingpassLoginButton.test.jsx  # Requires username typed before login (fireEvent.change + fake timers)
│           ├── PostOpChecklistDoc.test.jsx
│           ├── FinancialCounsellingDoc.test.jsx  # Site / Drug / Payment-mode parity, NOK Medisave handling
│           ├── MessageBubble.test.jsx
│           └── ChatWindow.test.jsx        # Mocks all 6 client.js exports; full state machine:
│                                          #   Singpass → ask_update → q_admission → q_stroke → q_eye
│                                          #   → cost_confirm → payment_mode → financial doc
│
├── backend/                           # FastAPI Python API
│   ├── main.py                        # App entry point, router registration, DB lifespan
│   ├── requirements.txt               # fastapi, uvicorn, sqlalchemy, asyncpg, motor,
│   │                                  # anthropic, python-dotenv, boto3, httpx
│   ├── Dockerfile                     # FastAPI backend image (uvicorn, port 8000)
│   ├── .env.example
│   ├── database/
│   │   ├── postgres.py                # SQLAlchemy async engine + session + Postgres seed
│   │   └── mongo.py                   # Motor async client + init_mongo() seeds P001/P002
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
│   │   │                              # GET /acknowledgement/latest/{patient_id}
│   │   ├── patient.py                 # GET /patient/{id}, POST /patient (DB-backed)
│   │   ├── symptom.py                 # POST /symptoms
│   │   └── chatbot.py                 # POST /chat
│   ├── services/
│   │   ├── epic_service.py            # EPIC façade — reads Postgres (TBL_PATIENT) and Mongo (REC-{id}-001 seed)
│   │   ├── acknowledgement_service.py # Mongo + Postgres write
│   │   ├── symptom_service.py         # Keyword-based triage (MILD/SEVERE/UNCLEAR)
│   │   └── llm_service.py             # AWS Bedrock AgentCore invoke client
│   ├── agents/                        # AWS Bedrock AgentCore multi-agent system
│   │   └── coordinator/               # Single in-process orchestrator (port 8080)
│   │       ├── main.py               # AgentCore entrypoint — invokes the workflow
│   │       ├── agent.py              # Microkernel CORE: escalate → triage → <plug-in> node;
│   │       │                         #   builds the graph by iterating the specialist registry
│   │       ├── llm.py                # Shared Bedrock converse helper (invoke_model) + transcript parsing
│   │       ├── specialists/          # Microkernel PLUG-INS (auto-discovered at import)
│   │       │   ├── __init__.py       # pkgutil discovery — imports every plug-in module
│   │       │   ├── base.py           # Specialist contract + CoordinatorState
│   │       │   ├── registry.py       # @register decorator + get_specialists()
│   │       │   ├── financial.py      # FinancialSpecialist  (Bedrock converse)
│   │       │   └── healthcare.py     # HealthcareSpecialist (KB RAG + Bedrock)
│   │       ├── tools/
│   │       │   └── kb_tools.py       # search_medical_kb + format_kb_response (AWS KB RAG)
│   │       ├── Dockerfile
│   │       └── requirements.txt      # boto3, bedrock-agentcore, python-dotenv, langgraph
│   ├── scripts/
│   │   └── db/                          # Standalone DB-init scripts for prod deploys
│   │       ├── 01_postgres_schema.sql         # DDL (idempotent) — always run
│   │       ├── 02_postgres_reference_data.sql # IVT + payment-mode rows — always run
│   │       ├── 03_postgres_poc_seed.sql       # P001/P002 demo patients — staging only
│   │       ├── 01_mongo_schema.js             # Collection + indexes — always run
│   │       ├── 02_mongo_poc_seed.js           # P001/P002 canonical EPIC records — staging only
│   │       └── README.md                      # Run order, prod vs staging, verify steps
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
| GET | `/epic/patient/{id}` | UC1 | Retrieve patient demographics (FHIR Patient) | Yes (Singpass login fallback when not in DB) |
| GET | `/epic/patient/{id}/record` | UC1 | Retrieve clinical record (FHIR DiagnosticReport) | Yes (UC2 login — fetches latest record for known EPIC patient) |
| GET | `/patient/{id}` | UC2 | Fetch patient from PostgreSQL `TBL_PATIENT` | Yes (Singpass login primary DB lookup) |
| POST | `/patient` | UC2 | Register new patient (name / DOB / phone) | Yes (new-patient registration sub-flow) |
| POST | `/acknowledgement` | UC2 | Submit patient acknowledgement + payment | Yes (ChatWindow UC2 flow) |
| GET | `/acknowledgement/latest/{patient_id}` | UC2 | Most recent MongoDB record for patient | Yes (returning patient — skip re-asking history) |
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

Chat header navigation (top bar of ChatWindow):
  • ←  Back     → calls onBack prop → App.jsx resets screen = 'onboarding'
  • ↑  To-top   → smooth-scrolls the message thread back to the first message
  • ♪  Sound    → placeholder (no handler yet)
  • 🎤 Mic      → placeholder (no handler yet)
```

### General Enquiry — LLM Q&A
```
User taps "General Enquiry" pill  →  mode = 'general_enquiry'
  → Bot: "Sure, I can assist to answer general enquiries about eye procedures or surgery."
  → A "Return Menu" chip is shown above the input bar throughout General Enquiry
    (showReturnMenu is true for mode === 'general_enquiry'), so the user can reset
    to the welcome menu at any point without finishing a flow.

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
  → handleSingpassLogin(patientId) resolves identity in this order:
       1. GET /patient/{id}                 → existing patient in PostgreSQL
       2. GET /epic/patient/{id}/record     → fall back to mocked EPIC seed
       3. Neither found                     → new-patient registration:
              regStep: 'name' → 'dob' → 'phone' → POST /patient → continue UC2
              Validation per field (re-asks on failure, does not advance):
                • name  : 1–255 chars (TBL_PATIENT.patient_name varchar(255))
                • dob   : strict DD-MM-YYYY, day 1–31, month 1–12, year 1900–current
                • phone : digits only, optional leading '+', max 20 chars (varchar(20))
       Safety net: if (1) succeeds but (2) fails, epicRecord is seeded with
         { patient_id, record_name } so buildPayload writes the acknowledgement under
         the real patient_id instead of falling back to 'UNKNOWN' (which would orphan
         the record from later /acknowledgement/latest lookups).
  → If existing patient: bot greets "Welcome back, …" and asks
       "Would you like to update your information? Yes/No"  (preProcStep = 'ask_update')
     • Yes → re-asks 3 medical history questions below
     • No  → GET /acknowledgement/latest/{patient_id} and renders FinancialCounsellingDoc
  → If new patient (after registration completes): preProcStep = 'q_admission'
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
        preProcStep → 'cost_confirm'

    Q4 (cost_confirm): "The total cost of the procedure will be $123, do you want to proceed? Yes/No"
        Yes  →  preProcStep = 'payment_mode'
        No   →  preProcStep = 'complete' (polite stop; Return Menu chip shown — NO submission)
        Invalid: bot re-asks Q4

    Q5 (payment_mode): "Would you like to use your Medisave or Next-of-Kin (NOK) Medisave?"
        Chips: Medisave / NOK Medisave
        Free text containing 'nok' / 'next-of-kin' / 'next of kin' → 'NOK Medisave'
        Free text containing 'medisave' (without NOK)            → 'Medisave'
        Stored in formAnswers.payment_mode and forwarded to buildPayload → payment.payment_mode.
        Bot then says: "I will now redirect you to fill up the Medisave form."
        preProcStep → 'complete', and only NOW the POST /acknowledgement fires.

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
        Fields:   Surgeon · Date · MCR · Site (LEFT / RIGHT / BOTH — mutually exclusive)
                  · Diagnosis (ICD-10)
        Procedure: 1B SL700V1A — Nurse-Led
        Drug:     Lucentis / Faricimab / Eylea / Others (mutually exclusive; matches
                  record_medication from EPIC, defaults to Faricimab when absent)
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
  → handleSingpassLogin resolves identity (same DB-first / EPIC-fallback chain as UC2),
    then builds the post-op record source as:
        epicRec  =  { ...EPIC record (if any), ...latest Mongo acknowledgement (if any) }
    Latest Mongo ack overrides EPIC fields (record_eyes, record_diagnosis, issued) so the
    most recent pre-proc submission drives the Post-Op display. EPIC-only fields not
    stored in Mongo (record_medication) survive the merge. This is what guarantees Site
    (Financial) and Eye (Post-Op) tally across the two flows for the same patient.
  → postOpStep = 'complete'
  → Bot: "Thanks for signing in. Here is your post-operation checklist."
  → ChatWindow renders PostOpChecklistDoc inline (no further API call):

        Title:   "POST INTRAVITREAL INJECTION — Advice form (filled)"

        You have:
          [✓] <diagnosis label from record_diagnosis>   e.g. Age-related macular degeneration

        Injection received:
          <Lucentis | Faricimab | Eylea | Others> · <Right | Left | Both> eye · <issued date>

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

### Form parity (UC2 ↔ UC3)

The Financial Counselling form (UC2) and the Post-Op Checklist (UC3) must show the same
two fields for the same patient — Site (LEFT/RIGHT/BOTH) and Drug (Lucentis/Faricimab/
Eylea/Others). Both forms derive these from the same canonical sources and use the same
fallback rules so they cannot drift:

| Field         | Canonical source                                                | Default if missing |
|---------------|-----------------------------------------------------------------|--------------------|
| Site          | latest Mongo `record_eyes` → EPIC `record_eyes` → user q_eye    | OD → RIGHT         |
| Drug          | latest Mongo `record_medication` (n/a today) → EPIC `record_medication` | Faricimab (Vabysmo) |
| Payment Mode  | user `payment_mode` step (Medisave / NOK Medisave) → payment.payment_mode | Medisave    |

`NOK Medisave` is operationally a Medisave payment (paid from a next-of-kin's account),
so the Financial form ticks the `Medisave` checkbox for both values. The NOK distinction
is preserved in the chat history and in `payment.payment_mode` for the eventual
downstream Medisave form.

Both forms use the same `value || default` fallback (not JS destructuring default) so that
an empty string from a stale Mongo doc still resolves to the canonical default in both
places. Drug-name matching is a case-insensitive `.includes()` over the four option names.

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

  → Coordinator runtime invokes a LangGraph StateGraph (compiled once at startup
    by create_agent(), which assembles the graph from the specialist registry):

       1. escalate  (entry node — always-on clinical safety gate)
          Reads the latest USER: ... line and runs a two-part check:
            • keyword scan (HIGH_RISK_MEDICAL_KEYWORDS, e.g. "pus", "cloudy cornea")
            • Bedrock converse(ESCALATION_REVIEW_SYSTEM_PROMPT) → strict-JSON
              { escalate, reason, detected_terms }
          If EITHER fires → route = "escalate": returns an urgent-hotline message
          and goes straight to END (no triage, no specialist).
          Otherwise → route = "triage", proceeds to llm_triage.

       2. llm_triage
          Asks Bedrock converse(modelId=BEDROCK_MODEL_ID) with a TRIAGE prompt
          that is BUILT DYNAMICALLY from each registered plug-in's `description`,
          classifying the query into exactly one registered label:
            • "financial"   — payment / Medisave / costs
            • "healthcare"  — symptoms, conditions, treatment, medication
          Unclear → defaults to "healthcare". Stores { route, kb_query }.
          (Adding a plug-in adds its label here automatically — no prompt edit.)

       3. Conditional edge routes to the matching specialist plug-in node:

          financial   → Bedrock converse(FINANCIAL_SYSTEM_PROMPT, kb_query)
                        → conservative financial guidance.
                        (specialists/financial.py)

          healthcare  → search_medical_kb(kb_query) hits
                        bedrock-agent-runtime.retrieve(AWS_KNOWLEDGE_BASE_ID,
                        AWS_KB_REGION) → format_kb_response() picks top-3 snippets,
                        then Bedrock converse(HEALTHCARE_SYSTEM_PROMPT) grounds the
                        answer in those snippets. Returns "No information available."
                        when the KB is empty / errored / has no relevant matches.
                        (specialists/healthcare.py)

       4. The escalate gate or the selected plug-in writes state["response"] → END.

  → main.py's @app.entrypoint reads response["response"] → returns
    { status, agent: "coordinator", response: text }
  → llm_service.py extracts that and returns reply string to POST /chat caller
    → appended as bot bubble in the chat thread.

Bedrock model defaults (overridable via env):
  - BEDROCK_MODEL_ID       = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
  - BEDROCK_TEMPERATURE    = 0.2
  - AWS_REGION (or _DEFAULT) determines the bedrock-runtime endpoint.
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
| payment_mode | varchar(50) | Medisave / NOK Medisave / Cash / MediShield / CHAS (Pydantic `Literal`) |

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
| EPIC integration | Façade reading from local Postgres + Mongo seed (P001, P002) | Real EPIC FHIR R4 API |
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
| Multi-agent | AWS Bedrock AgentCore + LangGraph | Single coordinator runtime; LangGraph StateGraph: escalate → triage → financial / healthcare specialist plug-ins (no cross-runtime ARN calls). Specialists are auto-discovered from `specialists/` (microkernel) |
| AWS SDK | boto3 1.39.0 | Bedrock runtime invocation |
| Containerization | Docker | One Dockerfile per agent runtime |
| CI/CD | GitHub Actions → AWS ECR | Automated build + push |
| Code quality | SonarQube + Snyk | Static analysis + security scanning |
| Frontend testing | Vitest 4 + React Testing Library | 90 tests across 7 files; runs in CI before build. ChatWindow tests mock all 6 `api/client` exports (the `vi.mock` factory must list every function ChatWindow imports — missing mocks silently force the runtime into `undefined()` calls that derail the flow) |

---

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `POSTGRES_URL` | FastAPI backend | PostgreSQL connection string. Repo `.env`: `postgresql+asyncpg://postgres:postgres@localhost:5432/eyecanhelpbuddy` |
| `MONGO_URL` | FastAPI backend | MongoDB connection string. Repo `.env`: `mongodb://localhost:27019` *(code-level fallback in `database/mongo.py` is `27017`)* |
| `MONGO_DB` | FastAPI backend | MongoDB database name. Default: `eyecanhelpbuddy` |
| `AWS_REGION` | FastAPI backend | AWS region for Bedrock (e.g. `us-east-1`) |
| `AWS_DEFAULT_REGION` | FastAPI backend | AWS SDK default region |
| `AGENTCORE_COORDINATOR_RUNTIME_ARN` | `llm_service.py` | ARN of the coordinator agent runtime |
| `AGENTCORE_COORDINATOR_ENDPOINT` | `llm_service.py` | Endpoint URL for coordinator runtime invocation |
| `AGENTCORE_TIMEOUT_SECONDS` | `llm_service.py` | HTTP timeout for AgentCore calls (default: `30`) |
| `AGENTCORE_RUNTIME_SESSION_ID` | `llm_service.py` | Optional fixed session ID; auto-generated (uuid4) if unset |
| `AWS_KNOWLEDGE_BASE_ID` | Coordinator agent | Knowledge Base ID used by `search_medical_kb` (required for the healthcare node) |
| `AWS_KB_REGION` | Coordinator agent | Region for KB queries (optional; defaults to `AWS_REGION`) |
| `BEDROCK_MODEL_ID` | Coordinator agent | Bedrock model id used by triage / financial / generic nodes via `converse`. Default: `global.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| `BEDROCK_TEMPERATURE` | Coordinator agent | Inference temperature for `converse` (default: `0.2`) |

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

### Local Databases

#### Prerequisites

Create `backend/.env` and ensure the three DB variables are set (the shipped `.env.example` does not include them — add them manually):

```bash
POSTGRES_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/eyecanhelpbuddy
MONGO_URL=mongodb://localhost:27019
MONGO_DB=eyecanhelpbuddy
```

> The host Mongo port is `27019` (mapped to container `27017`) because port `27017` is typically already occupied on dev machines. The code-level fallback in `backend/database/mongo.py` is `27017`; the `.env` value overrides it.

#### PostgreSQL (via Docker)

```bash
docker run -d \
  --name eyecanhelp-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=eyecanhelpbuddy \
  -p 5432:5432 \
  postgres:16
```

`init_db()` in `backend/database/postgres.py` runs on FastAPI startup (lifespan handler in `backend/main.py`) and:
- Creates `TBL_PATIENT`, `TBL_IVT`, `TBL_PAYMENT` via `Base.metadata.create_all()`.
- Seeds rows: 2 patients (`P001 Tan Ah Kow`, `P002 Lim Siew Eng`), 3 IVT medications (Faricimab / Ranibizumab / Aflibercept), 4 payment-mode rows (Medisave / Cash / MediShield / CHAS). Note: the `payment_mode` enum also accepts `NOK Medisave` at runtime, but no seed row uses it (it's written only when the user picks that option in the pre-procedure chat).
- Uses `ON CONFLICT DO NOTHING` — safe to restart the backend any number of times.

Verify tables and seed data:
```bash
docker exec eyecanhelp-postgres psql -U postgres -d eyecanhelpbuddy -c "\dt"
docker exec eyecanhelp-postgres psql -U postgres -d eyecanhelpbuddy -c "SELECT * FROM \"TBL_PATIENT\";"
```

#### pgAdmin (PostgreSQL UI in browser, optional)

```bash
docker run -d \
  --name pgadmin \
  -e PGADMIN_DEFAULT_EMAIL=admin@admin.com \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  -p 5050:80 \
  dpage/pgadmin4
```

Open **http://localhost:5050** and log in with `admin@admin.com` / `admin`.

To connect to the database inside pgAdmin:
1. Right-click **Servers** → **Register → Server**
2. **General** tab → Name: `eyecanhelp`
3. **Connection** tab:
   - Host: `172.17.0.1` *(Docker bridge IP — do not use `localhost`)*
   - Port: `5432`
   - Database: `eyecanhelpbuddy`
   - Username: `postgres`
   - Password: `postgres`
4. Click **Save**

#### MongoDB (via Docker)

```bash
docker run -d \
  --name eyecanhelp-mongo \
  -p 27019:27017 \
  mongo:8.0
```

`init_mongo()` in `backend/database/mongo.py` runs on FastAPI startup (lifespan handler in `backend/main.py`) and:
- Seeds the `TBL_PATIENT_RECORDS` collection with the two canonical "EPIC" records:
  `REC-P001-001` (Tan Ah Kow · H35.31 AMD · OD · Faricimab) and `REC-P002-001`
  (Lim Siew Eng · H36.0 DME · OS · Aflibercept) — `issued = 2020-01-01` (intentionally
  historical so any real submission is newer and wins the "latest" sort).
- Idempotent: upsert keyed by `record_id` with `$setOnInsert`, so re-runs leave existing
  docs untouched.
- The collection and the `eyecanhelpbuddy` database are created lazily on first write.

Verify the seed and any user acknowledgements:
```bash
docker exec eyecanhelp-mongo mongosh --quiet eyecanhelpbuddy --eval \
  "db.TBL_PATIENT_RECORDS.find({}, {patient_id:1, record_eyes:1, record_medication:1, issued:1, _id:0}).sort({issued:-1}).limit(10).toArray()"
```

#### Recommended startup order

1. Start the two database containers (`eyecanhelp-postgres`, `eyecanhelp-mongo`). pgAdmin is optional.
2. Start the FastAPI backend (`uvicorn main:app --reload`) — `init_db()` seeds Postgres and `init_mongo()` seeds the two canonical EPIC records on first boot.
3. Start the frontend (`npm run dev`) — Vite proxies `/api` → `http://localhost:8000`.

---

### Production database provisioning

The FastAPI startup hooks (`init_db()` + `init_mongo()`) are convenient for
dev but you usually don't want the app to be the one creating tables and
indexes in production. Standalone scripts mirror the same DDL + reference
data and can be executed by a DBA, a CI/CD job, or a Kubernetes init
container before the application boots.

Scripts live in [`backend/scripts/db/`](../backend/scripts/db/README.md).
All are idempotent. Run order:

```bash
# Production (no demo patients) ---------------------------------------
psql  "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f 01_postgres_schema.sql
psql  "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f 02_postgres_reference_data.sql
mongosh "$MONGO_URL"  --quiet --file 01_mongo_schema.js

# Staging / demo also runs the POC patient seed ----------------------
psql  "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f 03_postgres_poc_seed.sql
mongosh "$MONGO_URL"  --quiet --file 02_mongo_poc_seed.js
```

Notes:
- `POSTGRES_URL` for `psql` uses the libpq form (`postgres://user:pass@host:5432/db`),
  not the `postgresql+asyncpg://` URL the app uses — drop the `+asyncpg` suffix.
- The Mongo schema script also creates two performance indexes that the
  app relies on but never explicitly declares:
  `idx_record_id_unique` (unique on `record_id`, supports the EPIC seed
  lookup `REC-{id}-001`) and `idx_patient_id_issued_desc` (compound on
  `(patient_id, issued DESC)`, supports `GET /acknowledgement/latest/{id}`).
- The app's `init_db()` / `init_mongo()` remain safe to call after the
  scripts have run — they detect the populated state and no-op.

---

### Coordinator Runtime (AWS Bedrock AgentCore)

Only one runtime now — financial / healthcare / generic routing happens inside
the coordinator via LangGraph nodes rather than across separate runtimes.

```bash
# Build the Docker image from repo root
docker build -t eyecanhelp-coordinator:local -f backend/agents/coordinator/Dockerfile ./backend

# Or run locally (from backend/) — port 8080
python agents/coordinator/main.py
```
