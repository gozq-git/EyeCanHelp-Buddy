# Agents

This folder follows the `02-use-cases` style used in `awslabs/agentcore-samples`.

## Structure

- `coordinator/`: Single runtime that routes requests internally to financial or healthcare logic

## Runtime Roles

1. Coordinator Agent
- Entry point for user prompts
- Routes to financial or healthcare logic inside the same coordinator workflow
- Uses medical KB retrieval for healthcare responses

## Environment Variables

Set at minimum for coordinator runtime:

- `AWS_REGION`
- `AWS_KNOWLEDGE_BASE_ID`

## Run Locally

From `backend/`:

```powershell
python agents/coordinator/main.py
```
