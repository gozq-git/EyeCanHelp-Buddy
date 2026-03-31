# Tests

Test scripts for the multi-agent runtime setup.

## Files

- `test_multi_agent.py`: Integration-style runtime invocation test script

## Usage

From `backend/`:

```powershell
python tests/test_multi_agent.py <coordinator_runtime_arn> <financial_runtime_arn> <healthcare_runtime_arn>
```

This script:

1. Extracts AWS region from the runtime ARN
2. Invokes coordinator runtime with financial and healthcare prompts
3. Optionally invokes each specialist runtime directly
4. Prints responses for verification
