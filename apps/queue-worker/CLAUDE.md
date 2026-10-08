# Project Context: AITA-INTELLIGENT — Module 5 (Redis Queue & Git Analytics)
 
Scope for Milestone 2 (Weeks 3-5):
1. **BullMQ Queue & Worker Engine**: Orchestrate the automated grading pipeline (Receive job -> Sandbox -> AST Plagiarism -> Callback API Gateway).
2. **Git Analytics Skeleton (US-11)**: Lightweight service parsing commits and lines of code (LOC) per team member from a GitHub repository URL.
3. **Out of Scope**: GenAI (Module 3 - Huy) is NOT in scope for this milestone. Do not import, mock, or call any LLM.

## Architecture & Monorepo Structure
- Root workspace: Monorepo with `apps/api`, `apps/ast-engine`, `apps/sandbox-engine`, `apps/web`.
- This module lives inside: `apps/queue-worker/` (or structured under `apps/api/src/queue` & `apps/api/src/worker`).

## Teammates & Fixed Integration Contracts
- **An (Module 1 - API Gateway & Portal)**:
  - Produces jobs into BullMQ queue `submission-grading` when students call `POST /api/submissions`.
  - Stored files location: `apps/api/uploads/submissions/sub_<timestamp>_<randomHex>.zip`.
  - Callback Endpoint: `PATCH /api/submissions/:submissionId/result`.
  - Auth Header: `x-internal-key: <INTERNAL_API_KEY>` (Default in env: `aita_internal_secret_key_2026`).
  - Fixed Allowed Status Enum in DB: `["PENDING", "QUEUED", "RUNNING_TESTS", "GRADED", "COMPILATION_ERROR", "TIMEOUT", "SECURITY_VIOLATION"]`.
  - Progress Stepper Steps: `["QUEUED", "BUILDING", "RUNNING_TESTS", "AST_ANALYSIS", "AI_REVIEW", "COMPLETE"]`.
- **Thiên (Module 2 - Docker Sandbox)**:
  - Docker container execution via Dockerode. Standalone HTTP service (`http://localhost:5001`).
  - Business outcomes: `TIMEOUT`, `SECURITY_VIOLATION`, `COMPILATION_ERROR`, or `PASSED`/`FAILED` with score.
- **Nhật (Module 4 - AST Plagiarism Engine)**:
  - Python FastAPI service (`http://localhost:8001`).
  - Endpoint: `POST /analyze`. Thresholds: Warning >= 30%, Danger >= 60% (`PLAGIARISM_DETECTED`).
  - Optional non-blocking step: If AST service is down or code has syntax errors, report `SKIPPED`. Never fail the whole job.

## Hard Rules when Editing Code
1. **Never invent endpoints or field names**: All contracts live in `src/contracts/` using Zod schemas and TypeScript types.
2. **Never write directly to MSSQL Database**: Module 5 only reports progress via Module 1's callback API.
3. **Mock Client First**: Every client (`module1.client.ts`, `sandbox.client.ts`, `ast.client.ts`) must have a corresponding mock implementation switchable via `USE_MOCKS=true`.
4. **Error Classification Semantics**:
   - *Infrastructure Error* (Network, connection refused, 5xx, 429) -> Throw -> BullMQ retries with exponential backoff.
   - *Business Outcome* (`TIMEOUT`, `SECURITY_VIOLATION`, `COMPILATION_ERROR`) -> NOT an error. Report to Module 1, complete job immediately, DO NOT call AST.
   - *Validation Error* (Corrupt payload, 4xx other than 429) -> `UnrecoverableError` -> Do not retry, report failure to Module 1.
5. **Idempotency**: Always set `jobId = submissionId`. Re-enqueuing the same submission must not create duplicate processing.
6. **Logging**: Structured logging via `pino`. Never log raw source code or secrets. Always include `submissionId` and `jobId`.
7. **Quality**: TypeScript strict mode. Pass ESLint and Prettier with zero warnings.

## Output Style
Give a short design plan first, then code. Clearly list any open questions at the end.