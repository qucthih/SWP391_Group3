import pino from "pino";
import { config } from "./config.js";

/**
 * Structured Pino logger for Module 5.
 * Uses pino-pretty transport in development for human-readable logs.
 * Never logs raw source code or secrets (CLAUDE.md Rule 6).
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  base: {
    service: "queue-worker",
  },
  // Redact secrets from logs
  redact: {
    paths: ["headers.x-internal-key", "config.INTERNAL_API_KEY"],
    censor: "[REDACTED]",
  },
});
