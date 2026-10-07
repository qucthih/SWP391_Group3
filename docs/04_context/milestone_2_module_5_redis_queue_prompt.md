# Milestone 2 — Phân hệ 5 (Redis Queue & Git Analytics): Bộ Prompt Hoàn Chỉnh

> **Dành cho:** Trần Quốc Thịnh — Phụ trách Phân hệ 5 (Redis Queue & Git Analytics)  
> **Dự án:** AITA-INTELLIGENT (SWP391 — Nhóm 3)  
> **Phạm vi Milestone 2 (Tuần 3 - 5):** Xây dựng hạ tầng Hàng đợi BullMQ, Worker điều phối quy trình chấm điểm, và Skeleton Git Analytics cơ bản (US-11 & US-12).

---

## PHẦN A — Rules file cho AI IDE

*(Khuyến nghị lưu file này tại thư mục module: `apps/queue-worker/CLAUDE.md` hoặc `.cursor/rules/module5.mdc`)*

````markdown
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
````

---

## PHẦN B — Prompt chính (Dán vào AI IDE)

````markdown
You are helping me build Module 5 for the AITA-INTELLIGENT project (University Software Project - SWP391). 
Read and strictly adhere to the project rules in `CLAUDE.md`.

## Context & Scope (Milestone 2)
Build the asynchronous processing foundation:
1. A BullMQ Queue (`submission-grading`) and Worker that receives student code submissions, calls the Docker Sandbox (Module 2) and AST Plagiarism Engine (Module 4), and updates status in real-time to Module 1 (API Gateway).
2. A lightweight Git Analytics service (US-11) parsing commit counts and LOC per team member from a GitHub repo URL.
3. No GenAI integration in this milestone.

## Tech Stack
- Runtime: Node.js 20 LTS, TypeScript (strict), ESM.
- Dependencies: `bullmq` (^5.x), `ioredis` (^5.x), `axios` (^1.x), `zod` (^3.x), `pino` (^9.x), `dotenv` (^16.x).
- Dev/Test: `vitest`, `@types/node`, `typescript`, `eslint`, `prettier`.
- Location: Place the package in `apps/queue-worker/` (or integrate into `apps/api/src/queue` and `apps/api/src/worker`).

## Pipeline Specification (Per Job)
1. **Validate Job Payload**: Use Zod schema (`submissionId`, `assignmentId`, `studentId`, `language`, `fileRelativePath`, `submittedAt`).
2. **Notify Module 1 - Started**: 
   - `PATCH /api/submissions/:submissionId/result` (Header `x-internal-key: <INTERNAL_API_KEY>`)
   - Body: `{ status: "RUNNING_TESTS", step: "RUNNING_TESTS", progressPercent: 25, message: "Sandbox is compiling and executing test cases..." }`
3. **Call Sandbox (Module 2)**:
   - Send submission info + file path.
   - If response is `TIMEOUT`, `SECURITY_VIOLATION`, or `COMPILATION_ERROR`:
     - Callback Module 1 with that terminal status, `step: "COMPLETE"`, `totalScore: 0`, and execution details.
     - Finish the BullMQ job as SUCCESS (do not retry, DO NOT call AST).
4. **Notify Module 1 - AST Plagiarism Checking**:
   - Body: `{ status: "RUNNING_TESTS", step: "AST_ANALYSIS", progressPercent: 65, message: "Analyzing Abstract Syntax Tree for plagiarism..." }`
5. **Call AST Engine (Module 4) `POST /analyze`**:
   - Send Java source file path and submission metadata.
   - If AST fails or syntax error: log warning, mark plagiarism result as `SKIPPED`, and proceed.
   - If similarity > 60%: flag as suspicious, but still proceed to compute total score.
6. **Notify Module 1 - Final Result**:
   - Body: `{ status: "GRADED", totalScore: calculatedScore, step: "COMPLETE", progressPercent: 100, message: "Grading completed successfully." }`
7. **Complete Job**: Return structured result object from BullMQ processor.

## Requirements Details
1. **Queue Configuration (`src/queue/submission.queue.ts`)**:
   - Queue name: `submission-grading`.
   - Defaults: `attempts = 4` (1 initial run + 3 retries), `backoff: { type: 'exponential', delay: 2000 }` (2s, 4s, 8s).
   - `removeOnComplete: { count: 100 }`, `removeOnFail: { count: 500 }`.
   - Export helper `enqueueSubmission(payload: SubmissionJobPayload)`. Ensure `jobId = payload.submissionId`.
2. **Worker Implementation (`src/worker/submission.worker.ts`)**:
   - Concurrency configurable via `WORKER_CONCURRENCY` (default: 5).
   - Listen to `completed`, `failed`, `error` events with structured logs (`submissionId`, `jobId`, `attemptsMade`).
   - Graceful shutdown on `SIGTERM` / `SIGINT`.
   - If job fails permanently after exhausting 4 attempts: Safely callback Module 1 with `status: "COMPILATION_ERROR"` or a failure message so submission never hangs in `RUNNING_TESTS`.
3. **Typed Clients & Mocks (`src/clients/`)**:
   - `module1.client.ts`: Wraps `PATCH /api/submissions/:submissionId/result` with Axios, timeout, and `x-internal-key`.
   - `sandbox.client.ts`: Calls Sandbox HTTP API.
   - `ast.client.ts`: Calls AST Engine HTTP API.
   - Each client MUST have an in-memory Mock implementation toggled when `USE_MOCKS=true`:
     - Mock Sandbox: Simulates `PASSED` (10/10), `TIMEOUT`, `SECURITY_VIOLATION`, or `COMPILATION_ERROR` via test flags in payload.
     - Mock AST: Simulates Safe (12.5%) and Flagged (>60%) similarity.
4. **Git Analytics Service (`src/services/git-analytics.service.ts` - US-11)**:
   - A standalone service with method `analyzeRepository(repoUrl: string): Promise<GitAnalyticsResult>`.
   - Supports fetching commits via GitHub Public REST API (`https://api.github.com/repos/:owner/:repo/commits`) or fallback to mock data if offline/unauthenticated.
   - Returns: `{ totalCommits, memberStats: [{ author, commits, additions, deletions }] }`.
5. **Configuration & Contracts**:
   - `src/config.ts`: Zod-validated environment config.
   - `src/contracts/`: `job.contract.ts`, `module1.contract.ts`, `sandbox.contract.ts`, `ast.contract.ts`.

## Suggested Directory Structure
```
apps/queue-worker/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                     # Starts Worker
│   ├── config.ts                    # Zod env schema
│   ├── logger.ts                    # Pino logger
│   ├── contracts/
│   │   ├── job.contract.ts
│   │   ├── module1.contract.ts
│   │   ├── sandbox.contract.ts
│   │   ├── ast.contract.ts
│   │   └── git-analytics.contract.ts
│   ├── clients/
│   │   ├── module1.client.ts
│   │   ├── sandbox.client.ts
│   │   ├── ast.client.ts
│   │   └── mocks/
│   ├── queue/
│   │   ├── submission.queue.ts
│   │   └── producer.ts
│   ├── worker/
│   │   ├── submission.worker.ts
│   │   ├── processor.ts
│   │   └── error-classifier.ts
│   └── services/
│       └── git-analytics.service.ts  # US-11
├── test/
│   ├── processor.test.ts            # Vitest unit tests (Mocked clients)
│   └── git-analytics.test.ts
└── docs/
    └── module5-queue-contract.md    # Generated integration contract
```

## Deliverables
1. Complete, compiling TypeScript source code passing strict checks.
2. Complete `.env.example` file.
3. Unit test suite using Vitest (covering: Happy path, Sandbox Timeout/Security violation, AST Failure fallback, Retries exhausted).
4. `npm run smoke` script to trigger a sample job with `USE_MOCKS=true` and display terminal progress logs.
5. Markdown doc `docs/module5-queue-contract.md` summarizing the payload and API contracts.

Proceed step-by-step: give a concise architecture plan first, followed by the complete code files.
````

---

## PHẦN C — Tin nhắn chốt hợp đồng kỹ thuật (Gửi nhóm)

### 1. Gửi An (Module 1 — API Gateway & Portal)
> "An ơi, mình đã dựng xong hạ tầng Redis Queue & Worker (Module 5). Mình đã đối chiếu trực tiếp với code của An trong `apps/api/src/routes/submission.routes.ts` và chốt luôn như sau nhé:
> 1. **Callback API:** Worker của mình sẽ gọi thẳng endpoint có sẵn của An:  
>    `PATCH /api/submissions/:submissionId/result`  
>    Header: `x-internal-key: aita_internal_secret_key_2026`  
>    Status mình bắn sang: `RUNNING_TESTS`, `GRADED`, `TIMEOUT`, `SECURITY_VIOLATION`, `COMPILATION_ERROR` (chuẩn theo đúng mảng `ALLOWED_STATUS` của An). Mình gửi kèm cả `step`, `progressPercent`, `message` để An phát WebSocket cho Stepper.
> 2. **Payload An đẩy vào Queue:** Khi sinh viên nộp bài tại `POST /api/submissions`, An gọi helper `enqueueSubmission` của mình hoặc đẩy trực tiếp vào BullMQ queue `submission-grading` với JSON:
>    ```json
>    {
>      "submissionId": "uuid-cua-submission",
>      "assignmentId": "uuid-cua-assignment",
>      "studentId": "uuid-cua-student",
>      "language": "Java",
>      "fileRelativePath": "/uploads/submissions/sub_xxx.zip",
>      "submittedAt": "2026-10-05T08:00:00.000Z"
>    }
>    ```
> 3. Mình dùng `jobId = submissionId` để chống nộp trùng. An xác nhận để hai bên khóa luôn contract này nhé!"

---

### 2. Gửi Thiên (Module 2 — Sandbox Engine)
> "Thiên ơi, Worker của mình sẽ điều phối gọi sang Sandbox của bạn. Mình đề xuất contract đơn giản như sau:
> 1. Endpoint: `POST http://localhost:5001/api/sandbox/execute`
> 2. Request body mình gửi sang: `{ submissionId, language, zipFilePath, testCases }`
> 3. Response Thiên trả về đồng bộ (hoặc webhook):  
>    `{ status: "PASSED" | "FAILED" | "TIMEOUT" | "SECURITY_VIOLATION" | "COMPILATION_ERROR", totalScore, testResults: [...], stderr }`
> 4. Quy ước: Nếu code bị `TIMEOUT`, `SECURITY_VIOLATION`, `COMPILATION_ERROR` thì Thiên cứ trả về status đó với HTTP 200, mình sẽ coi là kết quả chấm hợp lệ và không retry. Chỉ khi container bị sập hoặc lỗi mạng 5xx thì mình mới retry 3 lần. Hiện tại mình đã có Mock Sandbox để chạy thử nghiệm độc lập."

---

### 3. Gửi Nhật (Module 4 — AST Engine)
> "Nhật ơi, Worker của mình sẽ gọi AST Engine của bạn sau khi Sandbox chạy xong:
> 1. Endpoint: `POST http://localhost:8001/analyze`
> 2. Request body mình gửi: `{ submissionId, assignmentId, sourceCodePath }`
> 3. Response Nhật trả về: `{ similarityPercent, isPlagiarism: boolean, matchedPairs: [...] }`
> 4. Mình đã cấu hình theo đúng SRS và file `config.py` của Nhật (ngưỡng 30% cảnh báo, 60% giữ điểm). Đặc biệt, mình coi AST là bước phụ: nếu server Python của Nhật bận hoặc code lỗi cú pháp không dựng được cây AST, Worker của mình sẽ đánh dấu `SKIPPED` và không làm gián đoạn bài chấm của sinh viên."

---

## Hướng dẫn sử dụng và triển khai thực tế

1. **Khởi tạo thư mục làm việc:**
   ```bash
   mkdir apps/queue-worker
   ```
2. **Lưu file rules:** Lưu toàn bộ nội dung **Phần A** vào `apps/queue-worker/CLAUDE.md`.
3. **Sinh mã nguồn bằng AI IDE:** Mở Cursor / Claude Code / Copilot tại thư mục `apps/queue-worker/` và dán toàn bộ **Phần B**.
4. **Kiểm thử độc lập:**
   ```bash
   cd apps/queue-worker
   npm install
   npm run test
   npm run smoke
   ```
5. **Đồng bộ với nhóm:** Gửi nội dung **Phần C** vào kênh chat Zalo/Discord của nhóm SWP391 Group 3.
