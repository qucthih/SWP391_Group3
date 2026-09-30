// ==============================================================================
// BASE PROVIDER — Lớp trừu tượng chung cho tất cả AI Providers
// Owner: Huy (Phân hệ 3)
// Tham chiếu SRS: R-02 (Fallback), NFR-07 (Timeout)
// ==============================================================================
//
// Tại sao cần lớp này?
// - Groq, Cerebras, Gemini đều có API format khác nhau (endpoint, headers, body).
// - Lớp BaseProvider "chuẩn hóa" phần chung (timeout, error mapping, retry headers)
//   để các lớp con chỉ cần implement phần riêng (buildRequestBody, parseResponse).
// - Gateway không cần biết đang nói chuyện với provider nào → Strategy Pattern.
// ==============================================================================

import {
  AIProvider,
  AIRequest,
  AIResponse,
  AIProviderError,
  AIErrorCode,
  ProviderName,
} from "../types.js";

/**
 * Cấu hình khởi tạo cho một provider cụ thể.
 */
export interface ProviderConfig {
  name: ProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

/**
 * Lớp trừu tượng (Abstract Class) mà mọi provider phải kế thừa.
 * Xử lý sẵn: timeout control, HTTP error → AIErrorCode mapping, latency tracking.
 */
export abstract class BaseProvider implements AIProvider {
  public readonly name: ProviderName;
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly model: string;
  protected readonly timeoutMs: number;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
  }

  /**
   * Gửi request chat completion đến provider.
   * Template Method Pattern: gọi buildRequestBody() và parseResponse()
   * do lớp con implement, còn phần fetch/timeout/error do lớp cha quản lý.
   */
  async chat(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body = this.buildRequestBody(request);
      const response = await fetch(`${this.baseUrl}${this.getEndpointPath()}`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw this.mapHttpError(response.status, await response.text());
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return this.parseResponse(data, latencyMs);
    } catch (error: unknown) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AIProviderError(
          `Request to ${this.name} timed out after ${this.timeoutMs}ms`,
          "TIMEOUT",
          this.name
        );
      }
      // Lỗi mạng (DNS fail, connection refused, etc.)
      const message = error instanceof Error ? error.message : String(error);
      throw new AIProviderError(
        `Network error calling ${this.name}: ${message}`,
        "NETWORK_ERROR",
        this.name
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check cơ bản: gửi 1 prompt ngắn, nếu không lỗi → provider sống.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.chat({
        systemPrompt: "You are a health check bot.",
        userPrompt: "Reply OK",
        maxTokens: 5,
        temperature: 0,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ==============================================================================
  // Các hàm con cần được Override bởi từng Provider cụ thể
  // ==============================================================================

  /** Đường dẫn API endpoint (vd: "/chat/completions") */
  protected abstract getEndpointPath(): string;

  /** Xây dựng request body theo format riêng của từng provider */
  protected abstract buildRequestBody(request: AIRequest): Record<string, unknown>;

  /** Parse response JSON từ provider thành AIResponse chuẩn */
  protected abstract parseResponse(data: unknown, latencyMs: number): AIResponse;

  // ==============================================================================
  // Các hàm tiện ích dùng chung
  // ==============================================================================

  /**
   * Build headers chuẩn cho hầu hết OpenAI-compatible providers.
   * Nếu provider nào cần headers đặc biệt, override hàm này.
   */
  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * Chuyển HTTP status code thành AIProviderError chuẩn hóa.
   * Gateway dùng errorCode này để quyết định retry hay fallback.
   */
  protected mapHttpError(statusCode: number, body: string): AIProviderError {
    let errorCode: AIErrorCode;
    let message: string;

    switch (true) {
      case statusCode === 401 || statusCode === 403:
        errorCode = "AUTH_ERROR";
        message = `Authentication failed for ${this.name} (HTTP ${statusCode})`;
        break;
      case statusCode === 429:
        errorCode = "RATE_LIMITED";
        message = `Rate limited by ${this.name} (HTTP 429). Body: ${body.substring(0, 200)}`;
        break;
      case statusCode >= 500:
        errorCode = "SERVER_ERROR";
        message = `Server error from ${this.name} (HTTP ${statusCode})`;
        break;
      default:
        errorCode = "UNKNOWN";
        message = `Unexpected HTTP ${statusCode} from ${this.name}: ${body.substring(0, 200)}`;
    }

    return new AIProviderError(message, errorCode, this.name, statusCode);
  }
}
