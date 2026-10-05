import { logger } from "../../logger.js";
import type {
  Module1CallbackBody,
  Module1CallbackResponse,
} from "../../contracts/module1.contract.js";
import type {
  ISandboxClient,
  SandboxRequest,
  SandboxResponse,
  SandboxOutcome,
} from "../../contracts/sandbox.contract.js";
import type {
  IAstClient,
  AstAnalysisRequest,
  AstAnalysisResponse,
} from "../../contracts/ast.contract.js";

// ─── Mock Module 1 Client ────────────────────────────────────────────────────

/**
 * In-memory mock for Module 1 callback.
 * Logs the callback body instead of making HTTP calls.
 */
export class MockModule1Client {
  public readonly callLog: Array<{
    submissionId: string;
    body: Module1CallbackBody;
  }> = [];

  async updateSubmissionResult(
    submissionId: string,
    body: Module1CallbackBody,
  ): Promise<Module1CallbackResponse> {
    this.callLog.push({ submissionId, body });

    logger.info(
      {
        submissionId,
        status: body.status,
        step: body.step,
        progressPercent: body.progressPercent,
      },
      `[MOCK] Module 1 callback: ${body.step} (${body.progressPercent}%)`,
    );

    return { success: true, message: "[MOCK] Result updated" };
  }
}

// ─── Mock Sandbox Client ─────────────────────────────────────────────────────

/**
 * In-memory mock for Sandbox Engine.
 *
 * Behavior is controlled by test flags in the submission payload:
 * - fileRelativePath contains "timeout"            → TIMEOUT
 * - fileRelativePath contains "security_violation"  → SECURITY_VIOLATION
 * - fileRelativePath contains "compilation_error"   → COMPILATION_ERROR
 * - Otherwise                                       → PASSED (10/10)
 */
export class MockSandboxClient implements ISandboxClient {
  async execute(request: SandboxRequest): Promise<SandboxResponse> {
    const filePath = request.fileRelativePath.toLowerCase();

    let outcome: SandboxOutcome = "PASSED";
    let passedTests = 10;
    const totalTests = 10;
    let executionTimeMs = 1250;
    let errorMessage: string | undefined;

    if (filePath.includes("timeout")) {
      outcome = "TIMEOUT";
      passedTests = 0;
      executionTimeMs = 30_000;
      errorMessage = "Execution exceeded time limit (30s)";
    } else if (filePath.includes("security_violation")) {
      outcome = "SECURITY_VIOLATION";
      passedTests = 0;
      executionTimeMs = 150;
      errorMessage = "Forbidden system call detected: Runtime.exec()";
    } else if (filePath.includes("compilation_error")) {
      outcome = "COMPILATION_ERROR";
      passedTests = 0;
      executionTimeMs = 80;
      errorMessage =
        "error: incompatible types: String cannot be converted to int";
    }

    logger.info(
      { submissionId: request.submissionId, outcome },
      `[MOCK] Sandbox result: ${outcome}`,
    );

    return {
      outcome,
      passedTests,
      totalTests,
      executionTimeMs,
      output: outcome === "PASSED" ? "All tests passed" : undefined,
      errorMessage,
    };
  }
}

// ─── Mock AST Client ─────────────────────────────────────────────────────────

/**
 * In-memory mock for AST Plagiarism Engine.
 *
 * Behavior:
 * - fileRelativePath contains "plagiarism" → 75% similarity (flagged)
 * - Otherwise                             → 12.5% similarity (clean)
 */
export class MockAstClient implements IAstClient {
  async analyze(request: AstAnalysisRequest): Promise<AstAnalysisResponse> {
    const filePath = request.fileRelativePath.toLowerCase();

    const isFlagged = filePath.includes("plagiarism");
    const similarityPercent = isFlagged ? 75 : 12.5;
    const message = isFlagged
      ? "High structural similarity detected with existing submissions"
      : "No significant similarity detected";

    logger.info(
      { submissionId: request.submissionId, similarityPercent },
      `[MOCK] AST result: ${similarityPercent}% similarity`,
    );

    return {
      similarityPercent,
      message,
      syntaxError: false,
    };
  }
}
