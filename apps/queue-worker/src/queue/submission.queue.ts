import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { SubmissionJobPayload } from "../contracts/job.contract.js";

/**
 * Shared Redis connection for BullMQ queue operations.
 */
export const redisConnection = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  db: config.REDIS_DB,
  maxRetriesPerRequest: null, // Required by BullMQ
});

/**
 * BullMQ Queue: submission-grading
 *
 * Defaults per spec:
 * - attempts = 4 (1 initial + 3 retries)
 * - backoff: exponential, 2s base (2s → 4s → 8s)
 * - removeOnComplete: keep last 100 jobs
 * - removeOnFail: keep last 500 jobs
 */
export const submissionQueue = new Queue<SubmissionJobPayload>(
  "submission-grading",
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  },
);

/**
 * Enqueue a submission for grading.
 * Sets jobId = submissionId for idempotency (CLAUDE.md Rule 5).
 * Re-enqueuing the same submissionId will not create duplicates.
 */
export async function enqueueSubmission(
  payload: SubmissionJobPayload,
): Promise<void> {
  const job = await submissionQueue.add("grade", payload, {
    jobId: payload.submissionId,
  });

  logger.info(
    {
      submissionId: payload.submissionId,
      jobId: job.id,
      assignmentId: payload.assignmentId,
    },
    "Submission enqueued for grading",
  );
}
