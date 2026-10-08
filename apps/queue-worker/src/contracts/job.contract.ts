import { z } from "zod";

/**
 * BullMQ Job Payload — validated at the start of every processor run.
 * Fields align with what Module 1 (API Gateway) enqueues after POST /api/submissions.
 */
export const SubmissionJobPayloadSchema = z.object({
  submissionId: z.string().min(1, "submissionId is required"),
  assignmentId: z.string().min(1, "assignmentId is required"),
  studentId: z.string().min(1, "studentId is required"),
  language: z.string().min(1, "language is required"),
  fileRelativePath: z.string().min(1, "fileRelativePath is required"),
  submittedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

export type SubmissionJobPayload = z.infer<typeof SubmissionJobPayloadSchema>;

/**
 * Structured result returned from the BullMQ processor on job completion.
 */
export interface SubmissionJobResult {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  /** Final status reported to Module 1 */
  finalStatus:
    "GRADED" | "COMPILATION_ERROR" | "TIMEOUT" | "SECURITY_VIOLATION";
  totalScore: number;
  /** Sandbox execution summary */
  sandbox: {
    outcome: string;
    passedTests: number;
    totalTests: number;
    executionTimeMs: number;
  };
  /** AST plagiarism summary */
  plagiarism: {
    status: "CLEAN" | "SUSPICIOUS" | "SKIPPED";
    similarityPercent: number;
    message: string;
  };
  /** ISO timestamp of when processing completed */
  completedAt: string;
}
