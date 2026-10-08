import type { Job } from "bullmq";
import { config } from "../config.js";
import { logger } from "../logger.js";
import {
  SubmissionJobPayloadSchema,
  type SubmissionJobPayload,
  type SubmissionJobResult,
} from "../contracts/job.contract.js";
import type { Module1CallbackBody } from "../contracts/module1.contract.js";
import {
  TERMINAL_OUTCOMES,
  type ISandboxClient,
  type SandboxResponse,
} from "../contracts/sandbox.contract.js";
import {
  AST_SIMILARITY_DANGER_THRESHOLD,
  type IAstClient,
  type AstAnalysisResponse,
  type PlagiarismStatus,
} from "../contracts/ast.contract.js";
import { Module1Client } from "../clients/module1.client.js";
import { SandboxClient } from "../clients/sandbox.client.js";
import { AstClient } from "../clients/ast.client.js";
import {
  MockModule1Client,
  MockSandboxClient,
  MockAstClient,
} from "../clients/mocks/index.js";
import { classifyError, ValidationError } from "./error-classifier.js";

// ─── Client Factory (Mock toggle via USE_MOCKS) ─────────────────────────────

type Module1Like = {
  updateSubmissionResult: Module1Client["updateSubmissionResult"];
};

function createClients(): {
  module1: Module1Like;
  sandbox: ISandboxClient;
  ast: IAstClient;
} {
  if (config.USE_MOCKS) {
    logger.warn("🧪 Running with MOCK clients (USE_MOCKS=true)");
    return {
      module1: new MockModule1Client(),
      sandbox: new MockSandboxClient(),
      ast: new MockAstClient(),
    };
  }
  return {
    module1: new Module1Client(),
    sandbox: new SandboxClient(),
    ast: new AstClient(),
  };
}

const clients = createClients();

// ─── Helper: Safe callback to Module 1 ──────────────────────────────────────

async function notifyModule1(
  submissionId: string,
  body: Module1CallbackBody,
): Promise<void> {
  try {
    await clients.module1.updateSubmissionResult(submissionId, body);
  } catch (err) {
    // Callback failure should throw for retry (infrastructure error)
    classifyError(err, "Module1 callback");
  }
}

// ─── Helper: Map sandbox outcome to submission status ───────────────────────

function mapOutcomeToStatus(
  outcome: string,
): "COMPILATION_ERROR" | "TIMEOUT" | "SECURITY_VIOLATION" {
  switch (outcome) {
    case "TIMEOUT":
      return "TIMEOUT";
    case "SECURITY_VIOLATION":
      return "SECURITY_VIOLATION";
    default:
      return "COMPILATION_ERROR";
  }
}

// ─── Main Processor Function ────────────────────────────────────────────────

/**
 * Core grading pipeline — processes a single submission job.
 *
 * Steps:
 * 1. Validate payload (Zod)
 * 2. Notify Module 1 → RUNNING_TESTS (25%)
 * 3. Call Sandbox (Module 2)
 * 4. If terminal outcome → callback, complete immediately (no AST)
 * 5. Notify Module 1 → AST_ANALYSIS (65%)
 * 6. Call AST Engine (Module 4) — non-blocking
 * 7. Compute final score, notify GRADED (100%)
 */
export async function processSubmission(
  job: Job<SubmissionJobPayload>,
): Promise<SubmissionJobResult> {
  const startTime = Date.now();
  const jobLog = logger.child({
    jobId: job.id,
    submissionId: job.data.submissionId,
    attemptsMade: job.attemptsMade,
  });

  // ── Step 1: Validate payload ──────────────────────────────────────────
  const parseResult = SubmissionJobPayloadSchema.safeParse(job.data);
  if (!parseResult.success) {
    const errorMsg = `Invalid job payload: ${parseResult.error.message}`;
    jobLog.error({ validationErrors: parseResult.error.flatten() }, errorMsg);
    throw new ValidationError(errorMsg);
  }

  const payload = parseResult.data;
  jobLog.info("Processing submission — pipeline started");

  // ── Step 2: Notify Module 1 → RUNNING_TESTS ──────────────────────────
  await notifyModule1(payload.submissionId, {
    status: "RUNNING_TESTS",
    step: "RUNNING_TESTS",
    progressPercent: 25,
    message: "Sandbox is compiling and executing test cases...",
  });

  // ── Step 3: Call Sandbox (Module 2) ───────────────────────────────────
  let sandboxResult: SandboxResponse;
  try {
    sandboxResult = await clients.sandbox.execute({
      submissionId: payload.submissionId,
      assignmentId: payload.assignmentId,
      language: payload.language,
      fileRelativePath: payload.fileRelativePath,
    });
  } catch (err) {
    classifyError(err, "Sandbox execution");
    // classifyError always throws — this line is unreachable
    throw err;
  }

  jobLog.info(
    {
      outcome: sandboxResult.outcome,
      passedTests: sandboxResult.passedTests,
      totalTests: sandboxResult.totalTests,
      executionTimeMs: sandboxResult.executionTimeMs,
    },
    `Sandbox complete: ${sandboxResult.outcome}`,
  );

  // ── Step 4: Terminal outcome → complete immediately, skip AST ─────────
  if (TERMINAL_OUTCOMES.has(sandboxResult.outcome)) {
    const terminalStatus = mapOutcomeToStatus(sandboxResult.outcome);

    await notifyModule1(payload.submissionId, {
      status: terminalStatus,
      step: "COMPLETE",
      progressPercent: 100,
      totalScore: 0,
      message:
        `Execution terminated: ${sandboxResult.outcome}. ${sandboxResult.errorMessage ?? ""}`.trim(),
    });

    jobLog.info(
      { finalStatus: terminalStatus },
      "Job completed with terminal sandbox outcome (AST skipped)",
    );

    return {
      submissionId: payload.submissionId,
      assignmentId: payload.assignmentId,
      studentId: payload.studentId,
      finalStatus: terminalStatus,
      totalScore: 0,
      sandbox: {
        outcome: sandboxResult.outcome,
        passedTests: sandboxResult.passedTests,
        totalTests: sandboxResult.totalTests,
        executionTimeMs: sandboxResult.executionTimeMs,
      },
      plagiarism: {
        status: "SKIPPED",
        similarityPercent: 0,
        message: "AST analysis skipped due to terminal sandbox outcome",
      },
      completedAt: new Date().toISOString(),
    };
  }

  // ── Step 5: Notify Module 1 → AST_ANALYSIS ───────────────────────────
  await notifyModule1(payload.submissionId, {
    status: "RUNNING_TESTS",
    step: "AST_ANALYSIS",
    progressPercent: 65,
    message: "Analyzing Abstract Syntax Tree for plagiarism...",
  });

  // ── Step 6: Call AST Engine (Module 4) — non-blocking ─────────────────
  let astResult: AstAnalysisResponse | null = null;
  let plagiarismStatus: PlagiarismStatus = "SKIPPED";
  let similarityPercent = 0;
  let plagiarismMessage = "AST analysis was skipped";

  try {
    astResult = await clients.ast.analyze({
      submissionId: payload.submissionId,
      assignmentId: payload.assignmentId,
      language: payload.language,
      fileRelativePath: payload.fileRelativePath,
    });

    similarityPercent = astResult.similarityPercent;

    if (astResult.syntaxError) {
      plagiarismStatus = "SKIPPED";
      plagiarismMessage =
        "AST analysis skipped due to syntax errors in source code";
      jobLog.warn("AST reported syntax error — marking plagiarism as SKIPPED");
    } else if (similarityPercent >= AST_SIMILARITY_DANGER_THRESHOLD) {
      plagiarismStatus = "SUSPICIOUS";
      plagiarismMessage = astResult.message;
      jobLog.warn(
        { similarityPercent },
        `⚠️ Plagiarism flagged: ${similarityPercent}% similarity (threshold: ${AST_SIMILARITY_DANGER_THRESHOLD}%)`,
      );
    } else {
      plagiarismStatus = "CLEAN";
      plagiarismMessage = astResult.message;
    }
  } catch (err) {
    // AST failure is non-blocking — log warning and proceed
    jobLog.warn(
      { error: err instanceof Error ? err.message : String(err) },
      "AST Engine call failed — marking plagiarism as SKIPPED",
    );
    plagiarismStatus = "SKIPPED";
    plagiarismMessage = "AST service unavailable — analysis skipped";
  }

  // ── Step 7: Compute final score ───────────────────────────────────────
  // Score = (passedTests / totalTests) * 10, scaled to 0-10
  const rawScore =
    sandboxResult.totalTests > 0
      ? (sandboxResult.passedTests / sandboxResult.totalTests) * 10
      : 0;
  const totalScore = Math.round(rawScore * 100) / 100; // 2 decimal places

  // ── Step 8: Notify Module 1 → GRADED ──────────────────────────────────
  await notifyModule1(payload.submissionId, {
    status: "GRADED",
    step: "COMPLETE",
    progressPercent: 100,
    totalScore,
    message: "Grading completed successfully.",
  });

  const elapsed = Date.now() - startTime;
  jobLog.info(
    { totalScore, plagiarismStatus, elapsedMs: elapsed },
    `✅ Grading complete: score=${totalScore}/10, plagiarism=${plagiarismStatus}`,
  );

  return {
    submissionId: payload.submissionId,
    assignmentId: payload.assignmentId,
    studentId: payload.studentId,
    finalStatus: "GRADED",
    totalScore,
    sandbox: {
      outcome: sandboxResult.outcome,
      passedTests: sandboxResult.passedTests,
      totalTests: sandboxResult.totalTests,
      executionTimeMs: sandboxResult.executionTimeMs,
    },
    plagiarism: {
      status: plagiarismStatus,
      similarityPercent,
      message: plagiarismMessage,
    },
    completedAt: new Date().toISOString(),
  };
}
