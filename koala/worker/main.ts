import { prismaClient } from "../prisma-client";
import { createReaderIngestTask } from "./reader-task";
import { runWorkerLoop } from "./run-loop";

const idleDelayMs = 800;

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
