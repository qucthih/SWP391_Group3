import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/**
 * Zod-validated environment configuration.
 * Fails fast at startup if required variables are missing or invalid.
 */
const envSchema = z.object({
  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().default(""),
  REDIS_DB: z.coerce.number().int().min(0).default(0),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Module 1 — API Gateway
  API_GATEWAY_URL: z.string().url().default("http://localhost:5000"),
  INTERNAL_API_KEY: z.string().min(1).default("aita_internal_secret_key_2026"),

  // Module 2 — Docker Sandbox
  SANDBOX_URL: z.string().url().default("http://localhost:5001"),

  // Module 4 — AST Plagiarism Engine
  AST_ENGINE_URL: z.string().url().default("http://localhost:8001"),

  // Mock mode
  USE_MOCKS: z
    .string()
    .transform((v) => v.toLowerCase() === "true")
    .default("false"),

  // Logging
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    console.error("❌ Invalid environment variables:", formatted);
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
