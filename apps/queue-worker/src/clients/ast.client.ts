import axios, { type AxiosInstance } from "axios";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type {
  IAstClient,
  AstAnalysisRequest,
  AstAnalysisResponse,
} from "../contracts/ast.contract.js";

/**
 * Module 4 (AST Plagiarism Engine) HTTP client.
 * Calls the Python FastAPI service at AST_ENGINE_URL.
 */
export class AstClient implements IAstClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.AST_ENGINE_URL,
      timeout: 30_000, // 30s for AST analysis
      headers: { "Content-Type": "application/json" },
    });
  }

  async analyze(request: AstAnalysisRequest): Promise<AstAnalysisResponse> {
    logger.info(
      { submissionId: request.submissionId },
      "Calling AST Plagiarism Engine",
    );

    const response = await this.http.post<AstAnalysisResponse>(
      "/analyze",
      request,
    );
    return response.data;
  }
}
