import { prismaClient } from "../prisma-client";
import { createReaderIngestTask } from "./reader-task";
import { runWorkerLoop } from "./run-loop";

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

const idleDelayMs = parsePositiveInt(
  process.env.WORKER_POLL_INTERVAL_MS,
  8000,
);

const shutdown = async (signal: string): Promise<void> => {
  console.log(`[worker] shutting down (${signal})`);
  await prismaClient.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

const start = async (): Promise<void> => {
  console.log("[worker] starting", {
    pollIntervalMs: idleDelayMs,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    pid: process.pid,
  });

  await runWorkerLoop({
    tasks: [createReaderIngestTask()],
    idleDelayMs,
  });
};

void start().catch(async (error: unknown) => {
  console.error("[worker] fatal error", error);
  await prismaClient.$disconnect();
  process.exit(1);
});
