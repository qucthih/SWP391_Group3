import axios, { type AxiosInstance } from "axios";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type {
  ISandboxClient,
  SandboxRequest,
  SandboxResponse,
} from "../contracts/sandbox.contract.js";

/**
 * Module 2 (Docker Sandbox Engine) HTTP client.
 * Calls the standalone sandbox service at SANDBOX_URL.
 */
export class SandboxClient implements ISandboxClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.SANDBOX_URL,
      timeout: 120_000, // 2 min — sandbox may run heavy workloads
      headers: { "Content-Type": "application/json" },
    });
  }

  async execute(request: SandboxRequest): Promise<SandboxResponse> {
    logger.info(
      { submissionId: request.submissionId, language: request.language },
      "Calling Sandbox Engine",
    );

    const response = await this.http.post<SandboxResponse>("/execute", request);
    return response.data;
  }
}
