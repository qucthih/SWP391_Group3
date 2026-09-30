// ==============================================================================
// AI GATEWAY — Trung tâm điều phối tất cả AI requests
// Owner: Huy (Phân hệ 3)
// Tham chiếu SRS: R-02 (Fallback), NFR-07 (Timeout), UC-01 Exception 11a
//
// Chiến lược xử lý lỗi (3 tầng):
//   1. Gọi Primary Provider
//   2. Nếu Primary lỗi retryable → Gọi Fallback Provider
//   3. Nếu cả 2 đều lỗi → Trả về status "AI_REVIEW_PENDING" (KHÔNG crash pipeline)
// ==============================================================================

import {
  AIProvider,
  AIRequest,
  AIResponse,
  AIProviderError,
  GatewayConfig,
  ProviderName,
  AIReviewStatus,
} from "./types.js";
import { createProvider } from "./providers/index.js";

/**
 * Kết quả trả về từ Gateway, bao gồm cả trường hợp thành công và thất bại.
 */
export interface GatewayResult {
  /** AI xử lý xong hay bị bỏ qua */
  status: AIReviewStatus;

  /** Dữ liệu response nếu thành công, null nếu AI_REVIEW_PENDING */
  data: AIResponse | null;

  /** Thông tin lỗi nếu cả 2 provider đều fail */
  error?: string;

  /** Log chi tiết các lần thử — dùng cho debugging và NFR-18 */
  attemptLog: AttemptLogEntry[];
}

/**
 * Log entry cho mỗi lần thử gọi provider.
 */
interface AttemptLogEntry {
  provider: ProviderName;
  success: boolean;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}

/**
 * Bộ đếm request theo provider và theo ngày.
 * Dùng in-memory cho M2 (Tuần 3-5). Chuyển sang Redis ở M3 khi có shared module.
 */
interface RequestCounter {
  [providerAndDate: string]: { total: number; errors: number };
}

export class AIGateway {
  private primary: AIProvider;
  private fallback: AIProvider;
  private config: GatewayConfig;
  private requestCounter: RequestCounter = {};

  constructor(config?: Partial<GatewayConfig>) {
    // Đọc cấu hình từ biến môi trường, cho phép override qua parameter
    this.config = {
      primaryProvider: (config?.primaryProvider ??
        process.env.AI_PRIMARY_PROVIDER ?? "groq") as ProviderName,
      fallbackProvider: (config?.fallbackProvider ??
        process.env.AI_FALLBACK_PROVIDER ?? "cerebras") as ProviderName,
      requestTimeoutMs: config?.requestTimeoutMs ??
        parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? "15000", 10),
      maxRetriesPerProvider: config?.maxRetriesPerProvider ?? 1,
    };

    // Lấy API keys từ biến môi trường
    const keys: Record<ProviderName, string> = {
      groq: process.env.GROQ_API_KEY ?? "",
      cerebras: process.env.CEREBRAS_API_KEY ?? "",
      gemini: process.env.GEMINI_API_KEY ?? "",
    };

    this.primary = createProvider(
      this.config.primaryProvider,
      keys[this.config.primaryProvider],
      this.config.requestTimeoutMs
    );
    this.fallback = createProvider(
      this.config.fallbackProvider,
      keys[this.config.fallbackProvider],
      this.config.requestTimeoutMs
    );
  }

  /**
   * Gửi request AI với cơ chế fallback tự động.
   *
   * Flow:
   * 1. Thử Primary → nếu thành công, trả về luôn.
   * 2. Nếu lỗi retryable → thử Fallback → nếu thành công, trả về.
   * 3. Nếu lỗi KHÔNG retryable (AUTH_ERROR) → dừng ngay, không fallback.
   * 4. Nếu cả 2 đều fail → trả về AI_REVIEW_PENDING (pipeline không bị crash).
   */
  async chat(request: AIRequest): Promise<GatewayResult> {
    const attemptLog: AttemptLogEntry[] = [];

    // === Bước 1: Thử Primary Provider ===
    const primaryResult = await this.tryProvider(this.primary, request);
    attemptLog.push(primaryResult.log);

    if (primaryResult.response) {
      this.incrementCounter(this.primary.name, false);
      return { status: "COMPLETED", data: primaryResult.response, attemptLog };
    }

    // Nếu lỗi không retryable (vd: AUTH_ERROR) → dừng, không thử fallback
    if (primaryResult.error && !primaryResult.error.isRetryable) {
      this.incrementCounter(this.primary.name, true);
      return {
        status: "AI_REVIEW_PENDING",
        data: null,
        error: `Primary (${this.primary.name}) failed with non-retryable error: ${primaryResult.error.message}`,
        attemptLog,
      };
    }

    this.incrementCounter(this.primary.name, true);

    // === Bước 2: Thử Fallback Provider ===
    console.warn(
      `[AIGateway] Primary provider "${this.primary.name}" failed ` +
      `(${primaryResult.error?.errorCode}). Switching to fallback "${this.fallback.name}"...`
    );

    const fallbackResult = await this.tryProvider(this.fallback, request);
    attemptLog.push(fallbackResult.log);

    if (fallbackResult.response) {
      this.incrementCounter(this.fallback.name, false);
      return { status: "COMPLETED", data: fallbackResult.response, attemptLog };
    }

    this.incrementCounter(this.fallback.name, true);

    // === Bước 3: Cả 2 đều fail → AI_REVIEW_PENDING ===
    const errorSummary =
      `All providers failed. ` +
      `Primary (${this.primary.name}): ${primaryResult.error?.message}. ` +
      `Fallback (${this.fallback.name}): ${fallbackResult.error?.message}.`;

    console.error(`[AIGateway] ${errorSummary}`);

    return {
      status: "AI_REVIEW_PENDING",
      data: null,
      error: errorSummary,
      attemptLog,
    };
  }

  /**
   * Thử gọi 1 provider cụ thể. Bắt mọi lỗi, KHÔNG throw ra ngoài.
   */
  private async tryProvider(
    provider: AIProvider,
    request: AIRequest
  ): Promise<{
    response: AIResponse | null;
    error: AIProviderError | null;
    log: AttemptLogEntry;
  }> {
    const startTime = Date.now();
    try {
      const response = await provider.chat(request);
      return {
        response,
        error: null,
        log: {
          provider: provider.name,
          success: true,
          latencyMs: response.latencyMs,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      const aiError =
        err instanceof AIProviderError
          ? err
          : new AIProviderError(
              err instanceof Error ? err.message : String(err),
              "UNKNOWN",
              provider.name
            );

      return {
        response: null,
        error: aiError,
        log: {
          provider: provider.name,
          success: false,
          latencyMs: Date.now() - startTime,
          errorCode: aiError.errorCode,
          errorMessage: aiError.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // ==============================================================================
  // Request Counter — Thống kê lượt gọi (in-memory cho M2, chuyển Redis ở M3)
  // ==============================================================================

  private incrementCounter(provider: ProviderName, isError: boolean): void {
    const dateKey = new Date().toISOString().slice(0, 10); // "2026-09-29"
    const key = `${provider}:${dateKey}`;

    if (!this.requestCounter[key]) {
      this.requestCounter[key] = { total: 0, errors: 0 };
    }
    this.requestCounter[key].total++;
    if (isError) {
      this.requestCounter[key].errors++;
    }
  }

  /**
   * Lấy thống kê request cho tất cả providers.
   * Dùng cho endpoint GET /api/ai/stats (Task 49 ở M3).
   */
  getStats(): Record<string, { total: number; errors: number; errorRate: string }> {
    const stats: Record<string, { total: number; errors: number; errorRate: string }> = {};
    for (const [key, value] of Object.entries(this.requestCounter)) {
      stats[key] = {
        ...value,
        errorRate: value.total > 0
          ? `${((value.errors / value.total) * 100).toFixed(1)}%`
          : "0%",
      };
    }
    return stats;
  }

  // ==============================================================================
  // Health Check & Info
  // ==============================================================================

  /**
   * Kiểm tra tình trạng của cả 2 providers.
   */
  async healthCheck(): Promise<{
    primary: { name: ProviderName; healthy: boolean };
    fallback: { name: ProviderName; healthy: boolean };
  }> {
    const [primaryHealth, fallbackHealth] = await Promise.all([
      this.primary.healthCheck(),
      this.fallback.healthCheck(),
    ]);

    return {
      primary: { name: this.primary.name, healthy: primaryHealth },
      fallback: { name: this.fallback.name, healthy: fallbackHealth },
    };
  }

  /**
   * Trả về thông tin cấu hình hiện tại (không bao gồm API keys).
   */
  getConfig(): Omit<GatewayConfig, "maxRetriesPerProvider"> & { status: string } {
    return {
      primaryProvider: this.config.primaryProvider,
      fallbackProvider: this.config.fallbackProvider,
      requestTimeoutMs: this.config.requestTimeoutMs,
      status: "initialized",
    };
  }
}
