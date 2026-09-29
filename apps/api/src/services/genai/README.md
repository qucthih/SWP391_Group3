# 🤖 GenAI Core & Review Hub (Phân hệ 3)

> **Owner:** Huy | **Tham chiếu SRS:** US-08, US-15, NFR-17, R-02

## Tổng quan

Module AI xử lý 3 tính năng chính:

| Tính năng | SRS | Mô tả |
|---|---|---|
| **Assignment Generation** | US-08 | Sinh đề bài + test cases từ mô tả ngắn |
| **Clean Code Review** | US-15 | Chấm điểm code quality (0-100) + nhận xét |
| **Error Explanation** | NFR-17 | Giải thích lỗi biên dịch bằng tiếng Việt |

## Kiến trúc

```
services/genai/
├── types.ts              # Định nghĩa kiểu dữ liệu
├── gateway.ts            # AI Gateway (Primary → Fallback → Pending)
├── index.ts              # Barrel export
├── providers/
│   ├── base.ts           # Abstract base class (Strategy Pattern)
│   ├── groq.ts           # Groq Cloud (llama-3.3-70b)
│   ├── cerebras.ts       # Cerebras (llama-3.3-70b)
│   ├── gemini.ts         # Google Gemini (gemini-2.0-flash)
│   └── index.ts          # Provider factory
├── prompts/
│   └── index.ts          # Tất cả prompt templates (CoT + Few-Shot)
├── benchmark/
│   └── run.ts            # Script đo hiệu năng providers
└── __tests__/
    └── gateway.test.ts   # Unit tests (mock, không gọi API thật)
```

## Cài đặt

```bash
# 1. Cài dependencies (từ thư mục apps/api/)
cd apps/api
npm install

# 2. Cấu hình API keys
cp .env.example .env
# Mở file .env và điền API keys thật vào phần GenAI Config
```

## Chạy Tests (không cần API keys)

```bash
npx tsx src/services/genai/__tests__/gateway.test.ts
```

## Chạy Benchmark (cần API keys)

```bash
npx tsx src/services/genai/benchmark/run.ts
```

Kết quả benchmark sẽ được xuất ra: `docs/genai/benchmark-results.csv`

## Chiến lược Fallback (R-02)

```
Request → Primary Provider (Groq)
              ↓ fail (429/5xx/timeout)?
         Fallback Provider (Cerebras)
              ↓ fail?
         Return { status: "AI_REVIEW_PENDING" }
         → Pipeline tiếp tục chấm bằng Test Cases + AST
         → Không crash hệ thống
```

## Quy ước cho các dev khác

- **Thịnh (Queue):** Gửi job type `AI_CLEAN_CODE_REVIEW` hoặc `AI_ERROR_EXPLANATION` qua Redis Queue. Xem contract tại `docs/api-contracts/genai-queue-contract.md`.
- **An (Portal):** Gọi endpoint `POST /api/assignments/generate` để sinh đề bài bằng AI. Input: `{ topic, language, difficulty }`.
- **Thiên (Sandbox):** Khi code compile lỗi, đảm bảo trả `stderr` sạch (không lẫn Docker log) để AI giải thích chính xác.
