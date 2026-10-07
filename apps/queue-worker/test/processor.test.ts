import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type {
  SubmissionJobPayload,
  SubmissionJobResult,
} from "../src/contracts/job.contract.js";

// ─── Mock the config module before importing processor ───────────────────────
vi.mock("../src/config.js", () => ({
  config: {
    USE_MOCKS: true,
    REDIS_HOST: "localhost",
    REDIS_PORT: 6379,
    REDIS_PASSWORD: "",
    REDIS_DB: 0,
    WORKER_CONCURRENCY: 5,
    API_GATEWAY_URL: "http://localhost:5000",
    INTERNAL_API_KEY: "test-key",
    SANDBOX_URL: "http://localhost:5001",
    AST_ENGINE_URL: "http://localhost:8001",
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
  },
}));

// Mock logger to suppress output during tests
vi.mock("../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Dynamically import after mocks are set up
const { processSubmission } = await import("../src/worker/processor.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockJob(
  overrides: Partial<SubmissionJobPayload> = {},
): Job<SubmissionJobPayload> {
  const defaultPayload: SubmissionJobPayload = {
    submissionId: "test-sub-001",
    assignmentId: "test-assign-001",
    studentId: "test-student-001",
    language: "java",
    fileRelativePath: "uploads/submissions/test_happy_path.zip",
    submittedAt: new Date().toISOString(),
    ...overrides,
  };

  return {
    id: defaultPayload.submissionId,
    data: defaultPayload,
    attemptsMade: 0,
    opts: { attempts: 4 },
  } as unknown as Job<SubmissionJobPayload>;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("processSubmission (Mock Clients)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy Path ────────────────────────────────────────────────────────
  it("should grade a successful submission with 10/10 score", async () => {
    const job = createMockJob();
    const result = await processSubmission(job);

    expect(result.finalStatus).toBe("GRADED");
    expect(result.totalScore).toBe(10);
    expect(result.sandbox.outcome).toBe("PASSED");
    expect(result.sandbox.passedTests).toBe(10);
    expect(result.sandbox.totalTests).toBe(10);
    expect(result.plagiarism.status).toBe("CLEAN");
    expect(result.plagiarism.similarityPercent).toBe(12.5);
    expect(result.completedAt).toBeTruthy();
  });

  // ── Sandbox TIMEOUT ──────────────────────────────────────────────────
  it("should handle TIMEOUT — score 0, skip AST, complete job", async () => {
    const job = createMockJob({
      submissionId: "test-timeout-001",
      fileRelativePath: "uploads/submissions/timeout_case.zip",
    });

    const result = await processSubmission(job);

    expect(result.finalStatus).toBe("TIMEOUT");
    expect(result.totalScore).toBe(0);
    expect(result.sandbox.outcome).toBe("TIMEOUT");
    expect(result.plagiarism.status).toBe("SKIPPED");
    expect(result.plagiarism.message).toContain("terminal sandbox outcome");
  });

  // ── SECURITY_VIOLATION ───────────────────────────────────────────────
  it("should handle SECURITY_VIOLATION — score 0, skip AST", async () => {
    const job = createMockJob({
      submissionId: "test-security-001",
      fileRelativePath: "uploads/submissions/security_violation_test.zip",
    });

    const result = await processSubmission(job);

    expect(result.finalStatus).toBe("SECURITY_VIOLATION");
    expect(result.totalScore).toBe(0);
    expect(result.sandbox.outcome).toBe("SECURITY_VIOLATION");
    expect(result.plagiarism.status).toBe("SKIPPED");
  });

  // ── COMPILATION_ERROR ────────────────────────────────────────────────
  it("should handle COMPILATION_ERROR — score 0, skip AST", async () => {
    const job = createMockJob({
      submissionId: "test-compile-001",
      fileRelativePath: "uploads/submissions/compilation_error_test.zip",
    });

    const result = await processSubmission(job);

    expect(result.finalStatus).toBe("COMPILATION_ERROR");
    expect(result.totalScore).toBe(0);
    expect(result.sandbox.outcome).toBe("COMPILATION_ERROR");
    expect(result.plagiarism.status).toBe("SKIPPED");
  });

  // ── Plagiarism Flagged (>60%) ─────────────────────────────────────────
  it("should flag plagiarism when similarity > 60% but still grade", async () => {
    const job = createMockJob({
      submissionId: "test-plagiarism-001",
      fileRelativePath: "uploads/submissions/plagiarism_detected.zip",
    });

    const result = await processSubmission(job);

    expect(result.finalStatus).toBe("GRADED");
    expect(result.totalScore).toBe(10); // Still graded — plagiarism doesn't zero score
    expect(result.plagiarism.status).toBe("SUSPICIOUS");
    expect(result.plagiarism.similarityPercent).toBe(75);
  });

  // ── Invalid Payload ──────────────────────────────────────────────────
  it("should throw UnrecoverableError for invalid payload", async () => {
    const job = createMockJob({
      submissionId: "", // Invalid — empty string
    });

    await expect(processSubmission(job)).rejects.toThrow("Invalid job payload");
  });

  // ── Result structure validation ──────────────────────────────────────
  it("should return a complete SubmissionJobResult structure", async () => {
    const job = createMockJob();
    const result: SubmissionJobResult = await processSubmission(job);

    // Verify all required fields exist
    expect(result).toHaveProperty("submissionId");
    expect(result).toHaveProperty("assignmentId");
    expect(result).toHaveProperty("studentId");
    expect(result).toHaveProperty("finalStatus");
    expect(result).toHaveProperty("totalScore");
    expect(result).toHaveProperty("sandbox");
    expect(result).toHaveProperty("plagiarism");
    expect(result).toHaveProperty("completedAt");

    // Verify nested structure
    expect(result.sandbox).toHaveProperty("outcome");
    expect(result.sandbox).toHaveProperty("passedTests");
    expect(result.sandbox).toHaveProperty("totalTests");
    expect(result.sandbox).toHaveProperty("executionTimeMs");
    expect(result.plagiarism).toHaveProperty("status");
    expect(result.plagiarism).toHaveProperty("similarityPercent");
    expect(result.plagiarism).toHaveProperty("message");
  });
});
