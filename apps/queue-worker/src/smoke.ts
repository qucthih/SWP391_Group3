import { logger } from "./logger.js";
import { enqueueSubmission } from "./queue/producer.js";
import { startWorker } from "./worker/submission.worker.js";
import { redisConnection } from "./queue/submission.queue.js";
import { analyzeRepository } from "./services/git-analytics.service.js";

/**
 * Smoke test — enqueues sample jobs with USE_MOCKS=true and displays terminal progress.
 * Run with: npm run smoke
 */
async function smoke(): Promise<void> {
  logger.info("🔥 Starting smoke test (USE_MOCKS should be true)...\n");

  // Start the worker to process jobs
  const worker = startWorker();

  // Wait a moment for worker to be ready
  await delay(500);

  // ── Test 1: Happy path (PASSED) ──────────────────────────────────────
  logger.info("═══ Test 1: Happy Path (all tests pass) ═══");
  await enqueueSubmission({
    submissionId: "smoke-test-001",
    assignmentId: "assignment-java-101",
    studentId: "student-abc-123",
    language: "java",
    fileRelativePath: "uploads/submissions/sub_20261005_abc123.zip",
    submittedAt: new Date().toISOString(),
  });

  await delay(2000);

  // ── Test 2: Sandbox TIMEOUT ──────────────────────────────────────────
  logger.info("\n═══ Test 2: Sandbox Timeout ═══");
  await enqueueSubmission({
    submissionId: "smoke-test-002",
    assignmentId: "assignment-java-102",
    studentId: "student-def-456",
    language: "java",
    fileRelativePath: "uploads/submissions/sub_timeout_demo.zip",
    submittedAt: new Date().toISOString(),
  });

  await delay(2000);

  // ── Test 3: Security Violation ───────────────────────────────────────
  logger.info("\n═══ Test 3: Security Violation ═══");
  await enqueueSubmission({
    submissionId: "smoke-test-003",
    assignmentId: "assignment-java-103",
    studentId: "student-ghi-789",
    language: "java",
    fileRelativePath: "uploads/submissions/sub_security_violation_demo.zip",
    submittedAt: new Date().toISOString(),
  });

  await delay(2000);

  // ── Test 4: Compilation Error ────────────────────────────────────────
  logger.info("\n═══ Test 4: Compilation Error ═══");
  await enqueueSubmission({
    submissionId: "smoke-test-004",
    assignmentId: "assignment-java-104",
    studentId: "student-jkl-012",
    language: "java",
    fileRelativePath: "uploads/submissions/sub_compilation_error_demo.zip",
    submittedAt: new Date().toISOString(),
  });

  await delay(2000);

  // ── Test 5: Plagiarism Detection ─────────────────────────────────────
  logger.info("\n═══ Test 5: Plagiarism Detection (>60% similarity) ═══");
  await enqueueSubmission({
    submissionId: "smoke-test-005",
    assignmentId: "assignment-java-105",
    studentId: "student-mno-345",
    language: "java",
    fileRelativePath: "uploads/submissions/sub_plagiarism_flagged.zip",
    submittedAt: new Date().toISOString(),
  });

  await delay(3000);

  // ── Git Analytics Demo ───────────────────────────────────────────────
  logger.info("\n═══ Git Analytics (US-11) — Mock Mode ═══");
  const gitResult = await analyzeRepository(
    "https://github.com/example/SWP391_Group3",
    { forceMock: true },
  );
  logger.info({ gitResult }, "Git analytics result");

  // ── Shutdown ─────────────────────────────────────────────────────────
  logger.info("\n✅ Smoke test complete — shutting down");
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

smoke().catch((err) => {
  logger.fatal({ error: err }, "Smoke test failed");
  process.exit(1);
});
