export type WorkerTask = {
  name: string;
  runOnce: () => Promise<number>;
};

type WorkerLoopOptions = {
  tasks: WorkerTask[];
  idleDelayMs: number;
};

type LoopErrorDetails = {
  message: string;
  stack: string;
};

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const parseLoopError = (error: unknown): LoopErrorDetails => {
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

export const runWorkerLoop = async (
  options: WorkerLoopOptions,
): Promise<void> => {
  const shouldContinue = true;

  while (shouldContinue) {
    let processedCount = 0;

    for (const task of options.tasks) {
      const taskStartedAtMs = Date.now();

      try {
        const processed = await task.runOnce();
        if (processed > 0) {
          console.log("[worker] task-complete", {
            taskName: task.name,
            processed,
            taskMs: Date.now() - taskStartedAtMs,
          });
        }

        processedCount += processed;
      } catch (error) {
        const details = parseLoopError(error);

        console.error("[worker] task-failed", {
          taskName: task.name,
          taskMs: Date.now() - taskStartedAtMs,
          errorMessage: details.message,
          errorStack: details.stack,
        });
      }
    }

    if (processedCount === 0) {
      await wait(options.idleDelayMs);
    }
  }
};
