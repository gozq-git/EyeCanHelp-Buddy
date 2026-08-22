# General-Enquiry LLM Evals (DeepEval)

Opt-in evaluation suite for the general-enquiry chatbot. Unlike the unit /
integration suites, **these tests make real AWS Bedrock calls** — once to make
the coordinator agent answer each golden, and again for the LLM judge
(`deepeval.models.AmazonBedrockModel`) that scores the answers.

The suite is excluded from the default pytest run (see `pytest.ini`) and never
fails a build for missing setup: it **skips cleanly** when deepeval is not
installed or no AWS credentials are resolvable.

## Setup

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt   # installs deepeval
```

Required environment / credentials:

| Variable | Purpose | Default |
|---|---|---|
| AWS credentials | Any boto3-resolvable chain (env vars, `~/.aws`, SSO, role) | — |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | Bedrock region | `us-east-1` |
| `BEDROCK_MODEL_ID` | Model used by the agent to answer | `global.anthropic.claude-sonnet-4-6` |
| `EVAL_JUDGE_MODEL_ID` | Model used to judge answers | falls back to `BEDROCK_MODEL_ID` |
| `AWS_KNOWLEDGE_BASE_ID` | Medical KB for faithfulness tests | unset → faithfulness tests skip |
| `AWS_FINANCIAL_KNOWLEDGE_BASE_ID` | Financial KB (falls back to `AWS_KNOWLEDGE_BASE_ID`) | unset |
| `BEDROCK_GUARDRAIL_ID` + `BEDROCK_GUARDRAIL_VERSION` | Guardrail tests | unset → guardrail tests skip |

## Running

```bash
# from the repo root
make test-eval

# or directly
cd backend
python -m pytest tests/eval -m eval -v          # everything
python -m pytest tests/eval/test_ge_safety.py   # one metric file
python -m pytest tests/eval -k cataract         # one golden
```

On Windows without `make`:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/eval -m eval -v
```

## What is measured

| File | Metric / check | Judge calls? |
|---|---|---|
| `test_ge_relevancy.py` | `AnswerRelevancyMetric` on answerable + multilingual goldens | yes |
| `test_ge_faithfulness.py` | `FaithfulnessMetric` against the KB snippets captured from `kb_results` | yes |
| `test_ge_safety.py` | Escalation gate: deterministic route + TTSH hotline numbers; Bedrock guardrail: blocked/not-blocked + block message | no |
| `test_ge_routing.py` | Deterministic triage route equality (healthcare / financial / out_of_scope / escalate) | no |
| `test_ge_multilingual.py` | `GEval` "reply written entirely in the requested language" | yes |

Each golden is answered **once** per session and memoized (`run_agent`), so
multiple metric files reusing a golden do not multiply answer-side cost.

## Cost & latency

Rough guide: each answerable golden ≈ 3 answer-side Bedrock calls (escalation
gate, triage, specialist answer) + 1–3 judge calls per judged metric. A full run
is on the order of 60–120 Bedrock invocations and a few minutes. If judge cost
or latency hurts, point `EVAL_JUDGE_MODEL_ID` at a cheaper model.

## Adding goldens

Append to `datasets/general_enquiry_goldens.json`:

```json
{
  "id": "ge-my-new-question",
  "input": "…",
  "language": "en",            // en | zh | ms | ta
  "category": "answerable",    // answerable | escalation | out_of_scope | financial | multilingual | guardrail
  "expected_route": "healthcare"  // healthcare | financial | out_of_scope | escalate (omit for guardrail goldens)
}
```

Every golden with `expected_route` is automatically picked up by the routing
tests; category membership controls the metric suites.

## Flakiness policy

LLM-judged metrics are non-deterministic. Thresholds start lenient (0.5 in
`helpers.JUDGE_THRESHOLD`); tighten only after a few baseline runs. The
deterministic checks (routing, escalation, guardrail) should never flake — a
failure there is a real regression.
