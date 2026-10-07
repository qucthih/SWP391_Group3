/**
 * Module 2 (Docker Sandbox Engine) contract.
 * Service URL: http://localhost:5001
 *
 * Business outcomes per CLAUDE.md:
 * - PASSED / FAILED with score
 * - TIMEOUT
 * - SECURITY_VIOLATION
 * - COMPILATION_ERROR
 */

export interface SandboxRequest {
  submissionId: string;
  assignmentId: string;
  language: string;
  fileRelativePath: string;
}

export type SandboxOutcome =
  "PASSED" | "FAILED" | "TIMEOUT" | "SECURITY_VIOLATION" | "COMPILATION_ERROR";

/** Outcomes that are terminal — job completes immediately, no AST call */
export const TERMINAL_OUTCOMES: ReadonlySet<SandboxOutcome> = new Set([
  "TIMEOUT",
  "SECURITY_VIOLATION",
  "COMPILATION_ERROR",
]);

export interface SandboxResponse {
  outcome: SandboxOutcome;
  /** Number of test cases passed */
  passedTests: number;
  /** Total number of test cases */
  totalTests: number;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Compiler/runtime output (may be truncated) */
  output?: string;
  /** Error message if applicable */
  errorMessage?: string;
}

/**
 * Client interface for Sandbox — both real and mock implement this.
 */
export interface ISandboxClient {
  execute(request: SandboxRequest): Promise<SandboxResponse>;
}
