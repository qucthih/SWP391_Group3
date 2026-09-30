// ==============================================================================
// GENAI MODULE — Barrel Export
// Owner: Huy (Phân hệ 3)
//
// Import toàn bộ phân hệ GenAI chỉ cần 1 dòng:
//   import { AIGateway, buildCleanCodeReviewPrompt } from "../services/genai/index.js";
// ==============================================================================

// Core types
export {
  AIProvider,
  AIRequest,
  AIResponse,
  AIProviderError,
  AIErrorCode,
  ProviderName,
  GatewayConfig,
  AIJobType,
  AIReviewStatus,
  BenchmarkRun,
  BenchmarkSummary,
} from "./types.js";

// Gateway
export { AIGateway, GatewayResult } from "./gateway.js";

// Provider factory (dùng khi cần tạo provider riêng lẻ, vd: benchmark)
export { createProvider } from "./providers/index.js";

// Prompt builders
export {
  buildAssignmentGenerationPrompt,
  buildCleanCodeReviewPrompt,
  buildErrorExplanationPrompt,
  BENCHMARK_PROMPTS,
} from "./prompts/index.js";
