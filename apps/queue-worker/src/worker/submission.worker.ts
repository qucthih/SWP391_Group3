import { Worker } from "bullmq";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { redisConnection } from "../queue/submission.queue.js";
import { processSubmission } from "./processor.js";
import type { SubmissionJobPayload } from "../contracts/job.contract.js";
import { Module1Client } from "../clients/module1.client.js";
import { MockModule1Client } from "../clients/mocks/index.js";

/**
 * Create and start the BullMQ Worker for the submission-grading queue.
 *
 * Listens to completed, failed, and error events with structured logs.
 * Graceful shutdown on SIGTERM/SIGINT.
 *
 * If a job fails permanently after 4 attempts, safely callbacks Module 1
 * so submissions never hang in RUNNING_TESTS status.
 */
export function startWorker(): Worker<SubmissionJobPayload> {
  const worker = new Worker<SubmissionJobPayload>(
    "submission-grading",
    processSubmission,
    {
      connection: redisConnection,
      concurrency: config.WORKER_CONCURRENCY,
    },
  );

  // ── Event Listeners ─────────────────────────────────────────────────

  worker.on("completed", (job, result) => {
    logger.info(
      {
        jobId: job.id,
        submissionId: job.data.submissionId,
        attemptsMade: job.attemptsMade,
        finalStatus: result?.finalStatus,
        totalScore: result?.totalScore,
      },
      `✅ Job completed: ${job.data.submissionId}`,
    );
  });

  worker.on("failed", (job, err) => {
    if (!job) {
      logger.error({ error: err.message }, "Job reference lost on failure");
      return;
    }

    const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 4);

    logger.error(
      {
        jobId: job.id,
        submissionId: job.data.submissionId,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        isExhausted,
        error: err.message,
      },
      `❌ Job failed: ${job.data.submissionId} (attempt ${job.attemptsMade})`,
    );

    // If all retries exhausted, callback Module 1 so submission doesn't hang
    if (isExhausted) {
      void reportExhaustedFailure(job.data.submissionId, err.message);
    }
  });

  worker.on("error", (err) => {
    logger.error({ error: err.message }, "Worker error event");
  });

  logger.info(
    {
      concurrency: config.WORKER_CONCURRENCY,
      useMocks: config.USE_MOCKS,
    },
    "🚀 Submission grading worker started",
  );

  return worker;
}

/**
 * When all retries are exhausted, safely report failure to Module 1
 * so the submission never hangs in RUNNING_TESTS.
 */
async function reportExhaustedFailure(
  submissionId: string,
  errorMessage: string,
): Promise<void> {
  try {
    const module1 = config.USE_MOCKS
      ? new MockModule1Client()
      : new Module1Client();

    await module1.updateSubmissionResult(submissionId, {
      status: "COMPILATION_ERROR",
      step: "COMPLETE",
      progressPercent: 100,
      totalScore: 0,
      message: `Grading failed after all retry attempts: ${errorMessage}`,
    });

    logger.warn({ submissionId }, "Reported exhausted failure to Module 1");
  } catch (callbackErr) {
    logger.error(
      {
        submissionId,
        error:
          callbackErr instanceof Error
            ? callbackErr.message
            : String(callbackErr),
      },
      "Failed to report exhausted failure to Module 1",
    );
  }
}
