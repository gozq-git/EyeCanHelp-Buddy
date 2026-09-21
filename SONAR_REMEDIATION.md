# SonarCloud Remediation Report — EyeCanHelp-Buddy

Project: `gozq-git_EyeCanHelp-Buddy` · Dashboard:
https://sonarcloud.io/dashboard?id=gozq-git_EyeCanHelp-Buddy

This document records the full SonarCloud remediation effort: the 36 code issues
raised against the backend, and the two quality-gate *metrics* (coverage and
duplication) that failed alongside them.

**Legend:** `[x]` fixed and confirmed by SonarCloud · `[~]` fixed locally, awaiting
the next scan · `[ ]` open (with rationale) · ⚠️ = carried a real regression risk

> ### Status as of 2026-09-21
>
> The work now spans **two rounds**.
>
> - **Round 1** (§3–§8) — the 36 Sonar issues, the coverage fix and the duplication
>   fix. **Merged to `main` and scanned.** One issue (`S8544`) was left open by
>   decision, which kept the quality gate red.
> - **Round 2** (§9) — closes `S8544`, patches the Trivy pip CVEs, brings the
>   **frontend into Sonar's scope for the first time**, and ships the Snyk reports as
>   a CI artifact. **Complete and green locally; not yet committed or scanned.**
>
> For the current picture read §9 and §10. Sections §1–§8 describe round 1 as it
> stood at the last scan and are left as the historical record.

---

## 1. Executive summary

| Measure | Before | After | Gate threshold |
|---|---|---|---|
| Open issues | 36 | **1** | — |
| Coverage on new code | 60.9 % | **~97 %** (measured locally) | ≥ 80 % |
| Duplicated lines on new code | 4.9 % | **~1 %** (154 → ≤38 lines) | ≤ 3 % |
| Security rating on new code | C (3) | C (3) — **still failing** | A (1) |
| Reliability / Maintainability | A / A | A / A | A / A |
| Backend tests | 101 | **286** | — |

Two of the three gate failures are resolved. The third (`security_rating`) is a
single deliberately-deferred issue, explained in §6 — **and round 2 has since closed
it** (§9.1), so all three are now addressed pending a re-scan.

The headline finding: **most of the coverage failure was not missing tests — it
was a CI misconfiguration.** See §4.

Round 2 adds, on top of the table above:

| Measure | Before round 2 | After round 2 |
|---|---|---|
| Open Sonar issues | 1 (`S8544`) | **0** (pending scan) |
| Coordinator deps pinned | 0 of 120 | **120 of 120** |
| `pip` CVEs in both images | 6 | **0** |
| Frontend in Sonar's scope | not scanned at all | **scanned, 85.5 % line coverage** |
| Frontend tests | 129 | **176** (+47, across 13 → 15 files) |
| Backend tests | 305 | **309** (+4) |
| Snyk SCA/SAST results | run log only | **uploaded as `snyk-report` artifact** |

---

## 2. How the quality gate works here

SonarCloud's default "Sonar way" gate judges **new code** (here: a rolling 30-day
window, baseline 2026-06-25), not the whole codebase. That is why the report
shows `new_coverage` and `new_duplicated_lines_density` rather than the overall
figures — a project can have 55 % overall coverage and still pass, provided
recently-changed lines are well covered.

Gate conditions and their state at the last scan (analysis `520082f8`,
2026-08-15, revision `f4288139` = merge of PR #53 into `main`):

| Condition | Threshold | Actual | Status |
|---|---|---|---|
| `new_coverage` | ≥ 80 % | 60.9 % | ❌ → fixed (§4) |
| `new_duplicated_lines_density` | ≤ 3 % | 4.9 % | ❌ → fixed (§5) |
| `new_security_rating` | A | C | ❌ open (§6) |
| `new_reliability_rating` | A | A | ✅ |
| `new_maintainability_rating` | A | A | ✅ |
| `new_security_hotspots_reviewed` | 100 % | 100 % | ✅ |

Scanner wiring: `sonar-project.properties` sets
`sonar.sources=./backend/services/,./backend/agents/,./backend/database/` and
`sonar.tests=./backend/tests/`; the workflow passes
`-Dsonar.python.coverage.reportPaths=backend/coverage.xml`.

---

## 3. The 36 code issues (batches A–I)

All fixed except `S8544`. SonarCloud independently confirms **1 open issue**
remaining, down from 36.

### Batch A — Docker security (`docker:*`, VULNERABILITY-typed)
- [x] `S6471` `agents/coordinator/Dockerfile:1` — run as non-root (`USER appuser`)
- [x] `S8541` `agents/coordinator/Dockerfile:9` — added `--only-binary=:all:` so no
      dependency can execute arbitrary code at install time. ⚠️ Risked breaking the
      build, so it was verified two ways: the image builds, and all **117** resolved
      wheels publish `cp312` `aarch64` builds — the platform `agents-cicd` targets.
- [ ] `S8544` `agents/coordinator/Dockerfile:10` — lock/hash-pin resolved versions.
      **Deliberately open — see §6.**
- [x] `S6470` `agents/coordinator/Dockerfile:11` — replaced `COPY . .` with
      `COPY agents/coordinator/`, and hardened `backend/.dockerignore`.
      Safe because every coordinator import is self-contained under that directory.

### Batch B — Dead code (`python:S125`)
- [x] `chatbot/llm.py:208` + `:211` — removed commented-out code by *activating* the
      HTTP fallback it described. Side effect: the non-streaming `/api/chat` now
      works against a local coordinator (see §7 for the streaming caveat).

### Batch C — Duplicate string literals (`python:S1192`)
- [x] `patient/model.py:78` — `gen_random_uuid()` → `GEN_RANDOM_UUID_SQL` (×5)
- [x] `chatbot/llm.py:24` — `application/json` → `CONTENT_TYPE_JSON` (×6)
- [x] `chatbot/llm.py:38` — `text/event-stream` → `CONTENT_TYPE_SSE` (×4)
- [x] `chatbot/llm.py:41` — `data: ` → `SSE_DATA_PREFIX` (×3)

### Batch D — FastAPI `Annotated` dependency injection (`python:S8410`)
- [x] `billing/router.py:17`, `chatbot/router.py:52`+`:53`, `patient/router.py:34`+`:50`

### Batch E — Document raised `HTTPException`s in `responses` (`python:S8415`)
- [x] `notifications/router.py:18` (500) + `:20` (502)
- [x] `billing/router.py:28` (400) + `:30` (404)
- [x] `chatbot/router.py:137` (404)
- [x] `patient/router.py:21` + `:29` + `:37` (404)

Verified in the live OpenAPI schema, not just the source.

### Batch F — Unused parameters (`python:S1172`) ⚠️ signature changes
- [x] `notifications/service.py:44` — dropped `_resolve_destination_email`, inlined
      the env lookup
- [x] `kb_tools.py:89` → `format_kb_response(results)`
- [x] `kb_tools.py:120` → `format_financial_kb_response(results)`
      (both call sites and the monkeypatched test doubles updated)

### Batch G — `async` without `await` (`python:S7503`)
- [x] `notifications/service.py:97` — the blocking Gmail build/send now run through
      `asyncio.to_thread`. This satisfies the rule **and** fixes a genuine defect:
      those calls were blocking the event loop.

### Batch H — Test smells
- [x] `S5778` `test_notification_service.py:81` + `:110` — one throwing call per
      `pytest.raises`
- [x] `S9100` `test_database.py:136` — removed a useless `yield`
- [x] `S8997` `test_database_modules.py:79` + `:89` — `monkeypatch.setattr` instead of
      mutating module state

### Batch I — Cognitive complexity (`python:S3776`) ⚠️⚠️
Threshold is 15. Each was fixed by extracting named helpers, with no behaviour change.

| Location | Before | After | How |
|---|---|---|---|
| `chatbot/router.py:50` `chatbot()` | 37 | ~4 | `_log_exchange_quietly`, `_iter_chunks_with_heartbeat` (`_HEARTBEAT` sentinel), `_stream_chat_events` |
| `chatbot/llm.py:23` `_extract_text` | 21 | ~2 | split into `_extract_json_text` / `_extract_sse_text`; keys → `JSON_TEXT_KEYS` |
| `chatbot/llm.py:124` `_stream_runtime_response` | 31 | ~8 | split into `_stream_sse_lines` / `_collect_json_stream` / `_read_whole_stream` |
| `agents/coordinator/main.py:29` `invoke()` | 22 | ~5 | nested generator lifted to `_stream_specialist_response` |

The SSE frames emitted are byte-identical to the originals — verified with
`curl … | cat -A` against the running server.

---

## 4. Coverage: 60.9 % → ~97 %

### Root cause — a CI configuration bug, not absent tests

`sonar.sources` includes `./backend/agents/`, but **no coverage run measured it**:

```
--cov=services --cov=routers --cov=schemas --cov=models --cov=database   ← no --cov=agents
```

Sonar therefore treated every line under `backend/agents/` as uncovered — **361 of
the 429 uncovered new lines (84 %)** — even though the tests already exercised
`financial.py` at 79 % and `healthcare.py` at 73 %.

A second, compounding cause: `agents/coordinator/agent.py` and `main.py` import
`langgraph` and `bedrock_agentcore` at module scope, and neither was in
`requirements-dev.txt`. Any test importing them failed at collection, so those two
files were genuinely untestable in CI — stuck at 0 %.

### Fixes
- [~] Added `--cov=agents` to the pytest step in **both** `tests-cicd.yml` and
      `backend-cicd full.yml` (the latter produces the `coverage.xml` Sonar reads).
- [~] Added `langgraph>=0.2.0,<0.4.0` and `bedrock-agentcore` to
      `requirements-dev.txt`, so the coordinator modules are importable under test.
      No production impact: neither Dockerfile installs `requirements-dev.txt`.
- [~] Wrote **185 new tests** across six files, all offline (boto3, Bedrock, the KB
      and the AgentCore runtime are faked).

| New test file | Tests | Target |
|---|---|---|
| `test_coordinator_agent.py` | 30 | escalation gate, triage routing, graph assembly |
| `test_kb_tools.py` | 32 | Bedrock KB retrieval, error wrapping, response formatting |
| `test_specialist_rag.py` | 55 | the extracted shared RAG module (§5) |
| `test_llm_streaming.py` | 40 | SSE/JSON streaming paths refactored in Batch I |
| `test_coordinator_llm.py` | 16 | Bedrock `converse` / `converse_stream` helpers |
| `test_coordinator_main.py` | 12 | AgentCore entrypoint, streaming + error paths |

### Result (measured locally over Sonar's exact source scope)

| Module | Before | After |
|---|---|---|
| `agents/coordinator/agent.py` | 0 % | **100 %** |
| `agents/coordinator/llm.py` | 13 % | **100 %** |
| `agents/coordinator/tools/kb_tools.py` | 15 % | **100 %** |
| `agents/coordinator/main.py` | 0 % | **95 %** |
| `agents/coordinator/specialists/rag.py` | — (new) | **100 %** |
| `services/chatbot/llm.py` | 75 % | **100 %** |
| **TOTAL** | **72 %** (375 / 1355 uncovered) | **97 %** (44 / 1355) |

Tests: **101 → 286**, all passing.

---

## 5. Duplication: 4.9 % → ~1 %

### Root cause — two copy-pasted specialists

100 % of the project's duplication sat in two files.
`specialists/financial.py` and `specialists/healthcare.py` were both 212 lines and
**byte-identical across lines 49–128** — an 80-line run covering query rewriting,
chat-context resolution, prompt assembly and `handle`/`handle_stream`. Sonar counted
77 duplicated lines in each: 154 total, exactly the project's whole duplication debt.

They differed only in prompt text, keyword lists, env-var prefix, log label, and
which KB search/format function they called.

### Fix
- [~] Extracted the shared machinery into **`specialists/rag.py`**: a frozen
      `RagProfile` dataclass for the per-specialist knobs, the shared functions, and a
      `RagSpecialist` base class carrying `handle`/`handle_stream`. Each specialist
      dropped from 212 → 93 lines.

**The design constraint worth presenting:** the existing tests monkeypatch
module-level names (`monkeypatch.setattr(financial, "invoke_model", …)`). Had the
shared code imported those callables itself, every one of those seams would have
broken. Instead each specialist keeps thin wrappers that pass its own globals
through — Python resolves those names *when the wrapper body runs*, so the patches
still land. **All 101 pre-existing tests passed untouched after the refactor.**

Longest identical run between the two files: **80 lines → 19** (6 of which are blank
or comment lines, and the whole block sits near Sonar's 100-token detection floor).
Even in the worst case that leaves ~38 duplicated lines against a ≥94-line budget.

---

## 6. `docker:S8544` — the gate's last blocker ✅ *resolved in round 2, see §9.1*

> **Superseded.** This section records why the issue was deferred on 2026-08-16. The
> deferral was reversed: the lock file was implemented and verified (§9.1). Kept
> because the reasoning — and the maintenance cost we accepted — is worth presenting.

*"Using dependencies without locking resolved versions is security-sensitive."*
`agents/coordinator/Dockerfile:10`, MAJOR, VULNERABILITY, 1 h effort.

This single issue holds `new_security_rating` at **C**, so **the gate will still fail
even with coverage and duplication green.** It is open by explicit decision
(2026-08-16), for these reasons:

- Fixing it means pinning all **117** transitive dependencies to exact versions with
  per-platform `--hash` entries, plus `--require-hashes` in the Dockerfile.
- After that, *every* dependency change must regenerate the lock file or the build
  breaks — a permanent maintenance cost.
- The related risk is already mitigated by `S8541` (`--only-binary=:all:`), which
  blocks arbitrary code execution at install time.

Options, if the gate must go green: implement the lock file, or mark the issue
*Won't Fix / Safe* in the SonarCloud UI with this rationale.

**Outcome (2026-09-21): the lock file was implemented.** The maintenance cost above
is real and we took it on deliberately; §9.1 documents the regeneration command that
makes it a one-liner. The `--hash` / `--require-hashes` half was *not* adopted — see
§9.1 for why version pinning alone was judged the right trade-off here.

---

## 7. Verification performed

Nothing here was verified by inspection alone.

- **Tests** — `python -m pytest` in `backend/`: **286 passed** after every batch.
- **Docker** — both images build; `import main` succeeds inside each. The scoped
  `COPY` was proven safe by running the coordinator in the built image and
  confirming both specialists are still discovered by the plug-in registry.
- **Wheel availability** — `pip download --only-binary=:all: --platform
  manylinux*_aarch64 --abi cp312` resolves all 117 coordinator wheels, so the
  arm64-only CI build is safe with `S8541`.
- **Live API** — backend run under uvicorn; drove `/api/chat` (streaming and not),
  `/api/patient/{uuid}`, `/api/epic/patient/{uuid}`, `/api/billing/calculate`, and
  the 404/400 paths. Batch E's documented responses were confirmed in the live
  OpenAPI schema.
- **The Batch I streaming refactor** — driven end to end by pointing boto3 at a local
  AgentCore stand-in. With a deliberate 2.5 s upstream stall it emitted **two
  `event: heartbeat` frames one second apart, resumed with the remaining chunks, then
  `event: done`** — confirming the `_HEARTBEAT` sentinel and the
  `asyncio.shield`/pending-task handling survived the refactor.
- **The §5 dedup refactor** — the real coordinator driven end to end with a stubbed
  model: triage → financial, triage → healthcare, escalation gate firing on a
  high-risk keyword, non-streaming `invoke()`, streaming `invoke()` (10 chunks), and a
  direct `HealthcareSpecialist().handle()` returning a grounded answer.
- **Frontend** — 127 component tests pass; production build succeeds (345 modules);
  the Vite dev server proxies to the backend successfully.

### Environment note (local-only, not a code defect)
General Enquiry does **not** answer on a local machine. The UI calls
`/api/chat?stream=true`, and `chat_stream()` has no HTTP fallback — it requires
`AGENTCORE_COORDINATOR_RUNTIME_ARN` plus AWS credentials. With neither set, the SSE
stream carries only `event: done`, and the UI renders *"No response returned from
coordinator runtime."* This asymmetry is pre-existing (confirmed against `aa425b2`):
`chat()` has a fallback, `chat_stream()` never did. Also note `.env` points the
coordinator at port `8080`, which a local WordPress container may already occupy.

---

## 8. Observations surfaced along the way

Not part of the Sonar issue list; recorded because they are real and were found while
fixing it.

1. **`backend/.env` was being baked into the backend image.** The old
   `.dockerignore` used `__pycache__/`, which matches only the *top level*; nested
   caches and `.env` were both being copied in. Now excluded, and verified absent
   from the rebuilt image. This was the most valuable security outcome of the work.
2. **Blocking I/O on the event loop** in `send_appointment_notification_email`
   (fixed in Batch G).
3. **Two patient id-spaces disagree.** The e2e helper and the `@integration` spec use
   the literal `P001`, but the Postgres seed uses UUIDs and `get_patient_from_epic`
   parses the id as a UUID; Mongo keys on `P001`. The `@integration` suite therefore
   self-skips against the shipped seed. Untouched — outside this scope.
4. **`should_rewrite_query` matches hints as bare substrings**, so `"it"` fires inside
   words like "intravitreal". Pre-existing; documented in a test comment rather than
   changed.
5. **`backend/Dockerfile` still uses `COPY . .`** — the same class of issue as
   `S6470`, but Sonar did not flag it, so it was left alone.

---

## 9. Round 2 — supply chain, image CVEs, and the frontend blind spot

Round 1 left the gate red on one issue and left an entire half of the product —
the React frontend — outside Sonar's scope. Round 2 closes both. 16 files modified,
4 added; backend **309 tests pass**, frontend **176 pass / 3 skipped**.

### 9.1 `docker:S8544` — the coordinator now builds from a lock file

`backend/agents/coordinator/requirements.lock` (new) pins **all 120 transitive
dependencies**; the Dockerfile installs from it instead of `requirements.txt`:

```dockerfile
-RUN pip install --no-cache-dir --only-binary=:all: -r ./requirements.txt
+RUN pip install --no-cache-dir --only-binary=:all: -r ./requirements.lock
```

`requirements.txt` stays as the human-edited statement of intent (8 loose ranges);
the lock is the resolved output. The file header carries the regeneration command so
this does not become tribal knowledge.

**The trade-off we took, and the half we declined.** §6 rejected this on maintenance
cost. That cost is real but bounded to one command per dependency change. What we
still decline is `--hash` / `--require-hashes`: hashes are **per-platform**, so the
CI arm64 build and any local amd64 build would need separate hash sets, and every
`pip` resolution difference becomes a hard build failure rather than a warning. The
threat hashes defend against — a tampered artifact on the index — is already largely
covered by `--only-binary=:all:` (§3 batch A), which stops any dependency executing
code at install time. Version pinning buys reproducibility; hashing buys integrity at
a disproportionate operational cost for a student-scale project. **This is the one
judgement call in round 2 worth defending out loud.**

*Note recorded, not changed:* `bedrock-agentcore` resolves to `0.1.0` rather than
`1.x` because `boto3` is pinned to `1.39.0` in `requirements.txt`. Lifting that pin
moves it to `1.22.0`.

### 9.2 Trivy: 6 `pip` CVEs in **both** images

The `python:3.12-slim` base ships `pip 25.0.1`, which Trivy flags for six CVEs
(CVE-2026-13346, CVE-2026-8643, CVE-2026-6357, CVE-2026-3219, CVE-2026-1703,
CVE-2025-8869 — malicious-index / malicious-wheel handling). Both `backend/Dockerfile`
and the coordinator Dockerfile now do:

```dockerfile
RUN pip install --no-cache-dir --upgrade "pip==26.2.1"
```

Pinned rather than a bare `--upgrade`, so the build stays reproducible — the same
principle as §9.1. Verified in the built image: `pip 26.2.1`.

### 9.3 `COPY .env* ./` → `COPY .env ./`

The glob matched `.env.example` and anything else in the context beginning `.env`,
so files nobody intended could reach the image. Now named explicitly. The deliberate
consequence: a local build without `backend/.env` **fails at this line** instead of
silently producing an unconfigured coordinator — the failure mode §8.1 warned about.

### 9.4 The frontend enters Sonar's scope for the first time

Until now `sonar.sources` covered only `backend/services/`, `backend/agents/` and
`backend/database/`. Every line of React was unanalysed. Also, the JS coverage path
pointed at `./backend/coverage/lcov.info` — a backend directory that never contained
a JavaScript report, so the setting was inert.

```properties
sonar.sources=...,./frontend/src/
sonar.tests=./backend/tests/,./frontend/src/__tests__/
sonar.exclusions=frontend/src/__tests__/**          # else counted twice
sonar.coverage.exclusions=frontend/src/main.jsx     # entry point, uncoverable
sonar.javascript.lcov.reportPaths=./reports/frontend/coverage/lcov.info
```

`vitest.config.js` gained the `lcov` reporter (it only emitted `text` and `html`, so
no machine-readable report existed to point at).

**47 new frontend tests** (129 → 176 across 13 → 15 files): `apiClient.test.jsx` and
`ChatWindow.test.jsx` carry the bulk, plus new `App.test.jsx` and `AppShell.test.jsx`.
Measured coverage: **85.5 % lines, 84.8 % statements, 91.4 % functions** — above the
80 % gate. See §10 for the one file still below it.

### 9.5 Snyk results escape the run log

Both Snyk steps keep `continue-on-error` (a finding should not fail the pipeline) but
now write JSON and upload it as the `snyk-report` artifact. Previously the results
existed only in the run log and were gone once the run aged out.

### 9.6 Backend issues found in code that landed after round 1

The guardrail feature merged to `main` after round 1 and brought its own smells:

- **`S3776` cognitive complexity** — `_extract_guardrail_output_message` in
  `services/chatbot/llm.py` was a four-deep nest of `isinstance`/`strip` checks.
  Split into `_clean_text`, `_text_from_content_part`, `_text_from_output_item`; the
  main function is now a flat loop plus a fallback. Behaviour identical, covered by
  **4 new tests** (non-dict outputs, blank nested text, top-level fallback, nothing
  usable).
- **`S8415` undocumented responses** — `POST /api/chat` raises 400 (blocked by
  guardrail) and 503 (guardrail unavailable); both now declared in `responses=`.
- **Test smell** — `test_kb_tools.py` had `assert a in out and b in out and c in out`;
  split into three asserts so a failure names which snippet is missing.

### 9.7 One change in this diff is **not** a Sonar fix

`frontend/src/components/ChatWindow.jsx` — behaviour and layout:

- *Return Menu* is now offered at **every** pre-procedure step rather than an
  enumerated list of them. The enumeration silently omitted the registration
  questions (name / DOB / phone), which run while `preProcStep` is still `login` —
  so a user could get stuck mid-form with no way back.
- The chip row collapsed from a nested two-container `space-between` layout to a
  single left-aligned flex row with *Return Menu* trailing the answer chips.

Called out separately because it is a **UX fix riding along in a security commit** —
split it out if the commit history should stay clean.

### 9.8 Verification performed (2026-09-21)

| What | Result |
|---|---|
| Backend `pytest` | **309 passed**, 1 unrelated LangChain deprecation warning |
| Frontend `vitest run --coverage` | **176 passed, 3 skipped**, 85.5 % lines |
| `lcov.info` written where Sonar looks | ✅ `reports/frontend/coverage/lcov.info` |
| **Lock completeness** | 120 pins resolve to exactly **120** packages — no unpinned transitive, no dead pin |
| **Lock resolves for CI's platform** | `pip install --dry-run --only-binary=:all: --platform manylinux2014_aarch64 --abi cp312` → exit 0, every package a wheel |
| Coordinator image builds | ✅ native build, all 14 steps |
| Image runs non-root | ✅ `uid=10001(appuser)` |
| `pip` CVEs cleared in image | ✅ `pip 26.2.1` |
| Scoped `COPY` still correct | image `/app` contains only `agents/`, `.env`, `requirements.{txt,lock}` |
| Locked deps import | ✅ `langgraph`, `bedrock_agentcore`, `dotenv`, `opentelemetry` |

**Not verified locally:** the **arm64** image build. CI builds
`--platform linux/arm64`, and this machine has no qemu/binfmt handler
(`exec format error` at the first `RUN`). The arm64 *dependency resolution* was
verified instead, which is the part the lock file actually changes; the build itself
is exercised by `agents-cicd.yml`.

---

## 10. Next actions

1. **Commit round 2** (see §11) — it is currently uncommitted working-tree state.
2. **Manually trigger the "Backend Full CI/CD Pipeline" workflow.** Its `push:`
   trigger is commented out, so it is `workflow_dispatch` only and the scan will not
   re-run on its own. This is the step that converts every `[~]` in this document
   into a `[x]`.
3. **Confirm on the dashboard:** `new_security_rating` A (S8544 closed),
   `new_coverage` ≥ 80 %, `new_duplicated_lines_density` ≤ 3 %.
4. **Watch `ChatWindow.jsx`.** At **73.6 % statements / 65.4 % branches** it is the
   only file below the 80 % gate, and round 2 modified it — so its changed lines
   count as new code. If `new_coverage` comes back short, this is where.
5. **`backend/Dockerfile` has three gaps the coordinator image already fixed** — they
   are unflagged only because `backend/Dockerfile` is outside `sonar.sources`:
   - runs as **root** (no `USER`; coordinator got `appuser` in batch A / `S6471`)
   - `COPY . .` (the `S6470` class — §8.5 noted it; still there)
   - no `--only-binary=:all:` and no lock file (`S8541` / `S8544` class)
6. **Get `.env` out of both images.** §8.1 fixed the accidental leak; the file is
   still copied in *deliberately*, and the built image confirms it (`/app/.env`,
   400 bytes). The durable fix is supplying config through the runtime's env
   configuration instead, then dropping the `COPY` and ignoring `.env` outright.
7. *Optional, not security:* give `chat_stream()` the HTTP fallback `chat()` has, so
   General Enquiry answers on a local machine (§7).

Items 5 and 6 are the natural round 3.

---

## 11. Commit history

Branch: `feature/EyeCanHelp-Buddy_Add_Frontend`.

| Commit | Contents | State |
|---|---|---|
| `aa425b2` | baseline before this work ("Add sonar-report") | on `main` |
| `944e451` | all 36 code issues — batches A–I (§3), 18 files | merged to `main` via PR #53, scanned |
| `afbe2fa` | §4 coverage + §5 duplication — 12 files, +1900/−320 | **content merged to `main`**; the commit object itself is dangling (it reached `main` via a later PR, not by fast-forward) |
| *uncommitted* | §9 round 2 — 16 modified, 4 added | **green locally, not committed, not scanned** |

`afbe2fa` contains: `--cov=agents` in both workflows, the coordinator test deps in
`requirements-dev.txt`, the new `specialists/rag.py` with both specialists reduced to
93 lines, and the six new test files (1560 lines of tests).

Round 2's uncommitted set:

```
 .github/workflows/backend-cicd full.yml          Snyk JSON + artifact upload
 backend/Dockerfile                               pip CVE pin
 backend/agents/coordinator/Dockerfile            lock install, pip pin, .env glob
 backend/agents/coordinator/requirements.lock     NEW — 120 pins
 backend/services/chatbot/llm.py                  S3776 guardrail extraction
 backend/services/chatbot/router.py               S8415 400/503
 backend/tests/unit/test_kb_tools.py              assertion split
 backend/tests/unit/test_llm_service_runtime.py   +4 guardrail tests
 frontend/vitest.config.js                        lcov reporter
 sonar-project.properties                         frontend in scope, lcov path
 frontend/src/components/ChatWindow.jsx           UX fix — not a Sonar item (§9.7)
 frontend/src/__tests__/*                         +47 tests, 2 files NEW
 SONAR_REMEDIATION.md                             NEW — this document
```
