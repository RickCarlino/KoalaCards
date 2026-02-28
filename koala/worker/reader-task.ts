import {
  claimNextQueuedReaderArticle,
  expireStaleReaderArticles,
  markReaderArticleIngestError,
  processClaimedReaderArticle,
} from "../reader/save-article";
import type { WorkerTask } from "./run-loop";

type WorkerErrorDetails = {
  message: string;
  stack: string;
};

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

const readerBatchSize = (): number => {
  return parsePositiveInt(process.env.READER_WORKER_BATCH_SIZE, 2);
};

const readerConcurrency = (): number => {
  return parsePositiveInt(process.env.READER_WORKER_CONCURRENCY, 2);
};

const staleAfterMinutes = (): number => {
  return parsePositiveInt(process.env.READER_WORKER_STALE_MINUTES, 10);
};

const hostnameFromUrl = (value: string): string => {
  try {
    return new URL(value).hostname;
  } catch {
    return "unknown";
  }
};

const compactTitle = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "(untitled)";
  }

  return trimmed.slice(0, 120);
};

const parseWorkerError = (error: unknown): WorkerErrorDetails => {
  if (error instanceof Error) {
    return {
      message: error.message || "Unknown worker error.",
      stack: error.stack ?? "",
    };
  }

  return {
    message: "Unknown worker error.",
    stack: "",
  };
};

const logReaderWorkerInfo = (
  message: string,
  details: Record<string, unknown>,
): void => {
  console.log(`[worker][reader-ingest] ${message}`, details);
};

const logReaderWorkerError = (
  message: string,
  details: Record<string, unknown>,
): void => {
  console.error(`[worker][reader-ingest] ${message}`, details);
};

export const createReaderIngestTask = (): WorkerTask => {
  let cycleCounter = 0;

  logReaderWorkerInfo("task-initialized", {
    defaultBatchSize: readerBatchSize(),
    defaultConcurrency: readerConcurrency(),
    staleAfterMinutes: staleAfterMinutes(),
  });

  return {
    name: "reader-ingest",
    runOnce: async () => {
      cycleCounter += 1;
      const cycleId = cycleCounter;
      const maxPerCycle = readerBatchSize();
      const configuredConcurrency = readerConcurrency();
      const workerCount = Math.min(maxPerCycle, configuredConcurrency);
      const staleMinutes = staleAfterMinutes();

      const staleErroredCount =
        await expireStaleReaderArticles(staleMinutes);
      if (staleErroredCount > 0) {
        logReaderWorkerInfo("stale-timeout-complete", {
          cycleId,
          staleErroredCount,
        });
      }

      let nextSlot = 0;
      let processed = 0;

      const processSlots = async (workerId: number): Promise<void> => {
        let hasMoreSlots = true;

        while (hasMoreSlots) {
          const slot = nextSlot;
          nextSlot += 1;
          hasMoreSlots = slot < maxPerCycle;

          if (!hasMoreSlots) {
            return;
          }

          const claimStartedAtMs = Date.now();
          const job = await claimNextQueuedReaderArticle();

          if (!job) {
            return;
          }

          const claimMs = Date.now() - claimStartedAtMs;
          const requestHost = hostnameFromUrl(job.requestUrl);

          logReaderWorkerInfo("job-claimed", {
            cycleId,
            workerId,
            slot,
            jobId: job.id,
            requestHost,
            title: compactTitle(job.title),
            claimMs,
          });

          const jobStartedAtMs = Date.now();

          try {
            const saved = await processClaimedReaderArticle(job);
            const processingMs = Date.now() - jobStartedAtMs;

            processed += 1;

            logReaderWorkerInfo("job-processed", {
              cycleId,
              workerId,
              slot,
              jobId: job.id,
              processingMs,
              translated: saved.translated,
              ingestStatus: saved.ingestStatus,
              normalizedHost: hostnameFromUrl(saved.normalizedUrl),
            });
          } catch (error) {
            const details = parseWorkerError(error);
            const processingMs = Date.now() - jobStartedAtMs;

            processed += 1;

            logReaderWorkerError("job-process-error", {
              cycleId,
              workerId,
              slot,
              jobId: job.id,
              requestHost,
              processingMs,
              errorMessage: details.message,
              errorStack: details.stack,
            });

            try {
              await markReaderArticleIngestError(job.id, error);

              logReaderWorkerInfo("job-marked-error", {
                cycleId,
                workerId,
                slot,
                jobId: job.id,
              });
            } catch (markError) {
              const markDetails = parseWorkerError(markError);

              logReaderWorkerError("job-mark-error-failed", {
                cycleId,
                workerId,
                slot,
                jobId: job.id,
                errorMessage: markDetails.message,
                errorStack: markDetails.stack,
              });
            }
          }
        }
      };

      const workers = Array.from({ length: workerCount }, (_, index) => {
        return processSlots(index + 1);
      });

      await Promise.all(workers);

      return processed;
    },
  };
};
