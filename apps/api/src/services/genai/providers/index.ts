// ==============================================================================
// PROVIDER FACTORY — Tạo instance provider từ tên và config
// Owner: Huy (Phân hệ 3)
// ==============================================================================

export { BaseProvider } from "./base.js";
export { GroqProvider } from "./groq.js";
export { CerebrasProvider } from "./cerebras.js";
export { GeminiProvider } from "./gemini.js";

import { AIProvider, ProviderName } from "../types.js";
import { GroqProvider } from "./groq.js";
import { CerebrasProvider } from "./cerebras.js";
import { GeminiProvider } from "./gemini.js";

/**
 * Factory function: tạo provider instance dựa trên tên.
 * Gateway gọi hàm này khi khởi tạo — không cần import từng provider riêng lẻ.
 *
 * @throws Error nếu tên provider không hợp lệ hoặc API key thiếu.
 */
export function createProvider(
  name: ProviderName,
  apiKey: string,
  timeoutMs: number
): AIProvider {
  if (!apiKey || apiKey.startsWith("your_") || apiKey.startsWith("gsk_your")) {
    throw new Error(
      `API key for provider "${name}" is missing or still using placeholder value. ` +
      `Please set a real key in your .env file.`
    );
  }

  switch (name) {
    case "groq":
      return new GroqProvider(apiKey, timeoutMs);
    case "cerebras":
      return new CerebrasProvider(apiKey, timeoutMs);
    case "gemini":
      return new GeminiProvider(apiKey, timeoutMs);
    default:
      throw new Error(`Unknown AI provider: "${name}". Supported: groq, cerebras, gemini`);
  }
}
