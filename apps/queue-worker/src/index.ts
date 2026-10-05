import { logger } from "./logger.js";
import { startWorker } from "./worker/submission.worker.js";
import { redisConnection } from "./queue/submission.queue.js";
import { config } from "./config.js";

/**
 * Entry point for Module 5 — Queue Worker.
 * Starts the BullMQ worker and handles graceful shutdown.
 */
async function main(): Promise<void> {
  logger.info(
    {
      nodeEnv: config.NODE_ENV,
      useMocks: config.USE_MOCKS,
      redisHost: config.REDIS_HOST,
      redisPort: config.REDIS_PORT,
    },
    "🔧 Module 5 — Queue Worker starting...",
  );

  const worker = startWorker();

  // ── Graceful Shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, `Received ${signal} — shutting down gracefully...`);

    try {
      // Close worker (wait for active jobs to finish)
      await worker.close();
      logger.info("Worker closed");

      // Close Redis connection
      await redisConnection.quit();
      logger.info("Redis connection closed");
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Error during shutdown",
      );
    }

    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ error: err }, "Fatal error starting worker");
  process.exit(1);
});
