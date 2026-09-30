## project member:
Nguyễn Văn An
Nguyễn Trí Thiện
Trần Quốc Thịnh
Trương Gia Huy
Hàng Võ Minh Nhật

# AITA-INTELLIGENT

**AI-Powered Teaching Assistant & AST Code Analytics Platform**

> SWP391 – Software Development Project, FPT University, Fall 2026
> Development Team: SWP391 – Group 3

## Overview

AITA-Intelligent is an intelligent programming education support platform that addresses three real-world challenges in university programming education:

- **Time-consuming manual grading** — lecturers spend hours grading code for large classes. AITA automates this process via the Code Execution Engine.
- **Sophisticated source code fraud** — students use AI (ChatGPT, Copilot) to write submissions and then disguise them (renaming variables, reordering functions). Traditional text-comparison tools are ineffective. AITA uses AST analysis combined with the Winnowing algorithm to detect this.
- **Lack of quality feedback** — students only see scores without understanding their mistakes. AITA integrates an LLM to explain errors in natural language.

## Project Scope

- Web Portal (PWA-ready) for students and lecturers (Mobile Native is a future scope item)
- Automated code grading system via a custom-built, self-hosted Docker sandbox (Code Execution Engine)
- Generative AI module (GenAI) supporting assignment generation, Clean Code grading, and compilation error explanation
- Source code plagiarism detection tool based on Abstract Syntax Tree (AST) analysis combined with the Winnowing algorithm
- Background processing queue (Redis Queue) and team contribution analysis via Git Analytics

## System Architecture

```
Client Layer          →  Web App (React + Vite + Tailwind)
Real-time Layer        →  WebSocket Server (Socket.io / SSE)
API Gateway Layer      →  API Gateway (Node.js + TypeScript + Prisma) + Auth Service (JWT + Google SSO)
Processing Layer       →  Redis Queue (BullMQ) · Code Execution Engine (Docker Orchestrator) ·
                           AST Engine (Java – Plagiarism Detection) · GenAI Service (LLM) · Git Analytics
Data Layer             →  MSSQL Server 2019 · Redis Cache · AI Logs / Audit
```

## 5 Core Subsystems

| # | Subsystem | Description | Key Technology | Owner |
|---|---|---|---|---|
| 1 | **Portal & Auth** | User interface, authentication, authorization | React, Vite, Tailwind, JWT, Google OAuth 2.0 | An |
| 2 | **Code Execution Engine** | Automated code grading in self-managed, isolated Docker containers | Docker Engine API (Dockerode), Node.js | Thiên |
| 3 | **GenAI Core & Review Hub** | Assignment generation, Clean Code grading, error explanation | Groq / Cerebras API, LangChain | Huy |
| 4 | **AST Plagiarism Detection** | Source code plagiarism detection using AST + Winnowing | ANTLR4 (Java grammar), FastAPI wrapper | Nhật |
| 5 | **Redis Queue & Git Analytics** | Background processing queue, team contribution analysis | BullMQ, Redis, Git CLI Parser | Thịnh |

## System Actors

- **Student** — submits assignments, views grading results, files an appeal
- **Lecturer** — creates classes, designs assignments, manages grading rubrics, monitors results, handles appeals
- **Administrator** — manages accounts, configures Sandbox settings, monitors system operations
- **AI Engine** *(system actor)* — generates assignments, generates rubrics, evaluates Clean Code, explains compilation errors
- **Code Execution Engine** *(system actor)* — creates isolated containers, compiles and executes code, enforces resource limits, returns results

## Core Workflow (Submit Assignment)

1. Student selects an assignment and uploads a `.zip` file containing source code
2. The system validates the file (≤10MB, correct format) and hashes it with SHA-256 for integrity verification
3. A `Submission` record is created with `PENDING` status and pushed to the Redis Queue (BullMQ)
4. The Code Execution Engine spins up an isolated Docker container, compiles the code, and runs it against each test case
5. The AST Engine parses the source code, generates a fingerprint, and checks for plagiarism (Winnowing)
6. The AI Engine evaluates Clean Code quality and explains compilation errors (if any)
7. The system aggregates the final score; status is updated to `COMPLETED` (similarity ≤ 60%) or `SCORE_WITHHELD` (similarity > 60%, pending lecturer review)
8. Results are sent to the student in real time via WebSocket

## Tech Stack

- **Frontend Web:** React 18+, Vite, TailwindCSS
- **Backend:** Node.js 20+, TypeScript, Prisma ORM
- **AST Engine:** Python 3.11+, FastAPI, ANTLR4 (`antlr4-python3-runtime`)
- **Database:** Microsoft SQL Server 2019+
- **Message Queue:** Redis 7+ with BullMQ
- **Code Execution:** Custom-built Docker sandbox orchestrated via Docker Engine API (Dockerode)
- **CI/CD:** GitHub Actions
- **Deployment:** Azure / AWS / Vercel

## MVP Scope Limitations (10-Week Timeline)

| Feature | MVP Scope | Future Scope |
|---|---|---|
| AST Plagiarism Detection | Java only (ANTLR parser) | Add Python (`ast` module), C# (Roslyn) |
| GenAI Assignment Generation | Basic draft generation (assignment description + sample test cases) | Full rubric auto-generation, multi-round refinement |
| Git Analytics | Basic metrics: commit count, LOC per member | PR analysis, contribution timeline charts |
| Code Execution Engine | Docker containers with basic resource limits | Stronger isolation via gVisor/Firecracker microVMs |
| Mobile App | Responsive web (PWA-ready) | Native React Native/Expo app |

## System Constraints

- Serves only FPT University students and lecturers (verified via `@fpt.edu.vn` / `@fe.edu.vn` email domains)
- Maximum submission file size: 10MB (`.zip`)
- Maximum code execution time: 30 seconds per grading run
- End-to-end grading pipeline (Sandbox + AST + AI) ≤ 90 seconds
- Development team: 5 students; development timeline: 10 weeks

## Project Structure

```
apps/
  api/       — Backend API Gateway (Node.js + TypeScript + Prisma)
  web/       — Frontend web app (React + Vite + Tailwind)
packages/    — Shared libraries across apps
docs/        — SRS documents, ERD, development notes
```

## References

1. Schleimer, S., Wilkerson, D.S., Aiken, A. (2003). *"Winnowing: Local Algorithms for Document Fingerprinting"*. ACM SIGMOD 2003.
2. Parr, T. (2010). *"Language Implementation Patterns"*. Pragmatic Bookshelf.
3. Sommerville, I. (2016). *"Software Engineering"*, 10th Edition. Pearson.
4. [Docker Engine API Documentation](https://docs.docker.com/engine/api/)