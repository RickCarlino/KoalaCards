import {
  claimNextQueuedReaderArticle,
  markReaderArticleIngestError,
  processClaimedReaderArticle,
  requeueStaleReaderArticles,
} from "../reader/save-article";
import type { WorkerTask } from "./run-loop";

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
  return parsePositiveInt(process.env.READER_WORKER_STALE_MINUTES, 20);
};

export const createReaderIngestTask = (): WorkerTask => {
  return {
    name: "reader-ingest",
    runOnce: async () => {
      await requeueStaleReaderArticles(staleAfterMinutes());

      const maxPerCycle = readerBatchSize();
      const workerCount = Math.min(maxPerCycle, readerConcurrency());
      let nextSlot = 0;
      let processed = 0;

      const processSlots = async (): Promise<void> => {
        let hasMoreSlots = true;

        while (hasMoreSlots) {
          const slot = nextSlot;
          nextSlot += 1;
          hasMoreSlots = slot < maxPerCycle;

          if (!hasMoreSlots) {
            return;
          }

          const job = await claimNextQueuedReaderArticle();
          if (!job) {
            return;
          }

          try {
            await processClaimedReaderArticle(job);
          } catch (error) {
            await markReaderArticleIngestError(job.id, error);
          }

          processed += 1;
        }
      };

      const workers = Array.from({ length: workerCount }, () => {
        return processSlots();
      });

      for (const worker of workers) {
        await worker;
      }

      return processed;
    },
  };
};
