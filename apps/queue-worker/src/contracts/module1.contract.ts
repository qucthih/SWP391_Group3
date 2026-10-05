/**
 * Module 1 (API Gateway) callback contract.
 * Endpoint: PATCH /api/submissions/:submissionId/result
 * Auth: Header `x-internal-key: <INTERNAL_API_KEY>`
 *
 * Fixed Allowed Status Enum (from CLAUDE.md):
 * ["PENDING", "QUEUED", "RUNNING_TESTS", "GRADED", "COMPILATION_ERROR", "TIMEOUT", "SECURITY_VIOLATION"]
 *
 * Progress Stepper Steps:
 * ["QUEUED", "BUILDING", "RUNNING_TESTS", "AST_ANALYSIS", "AI_REVIEW", "COMPLETE"]
 */

export type SubmissionStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING_TESTS"
  | "GRADED"
  | "COMPILATION_ERROR"
  | "TIMEOUT"
  | "SECURITY_VIOLATION";

export type GradingStep =
  | "QUEUED"
  | "BUILDING"
  | "RUNNING_TESTS"
  | "AST_ANALYSIS"
  | "AI_REVIEW"
  | "COMPLETE";

/**
 * Body sent to PATCH /api/submissions/:submissionId/result
 */
export interface Module1CallbackBody {
  status: SubmissionStatus;
  step: GradingStep;
  progressPercent: number;
  message: string;
  /** Only sent on final GRADED/terminal status */
  totalScore?: number;
  /** Optional AI feedback (not used in Milestone 2) */
  aiFeedback?: string;
}

/**
 * Response shape from Module 1 callback endpoint.
 */
export interface Module1CallbackResponse {
  success: boolean;
  message: string;
  data?: unknown;
}
