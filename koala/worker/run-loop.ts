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
  let iteration = 0;

  while (shouldContinue) {
    iteration += 1;
    const loopStartedAtMs = Date.now();
    let processedCount = 0;

    console.log("[worker] loop-start", {
      iteration,
      taskCount: options.tasks.length,
    });

    for (const task of options.tasks) {
      const taskStartedAtMs = Date.now();

      try {
        const processed = await task.runOnce();
        const taskMs = Date.now() - taskStartedAtMs;

        console.log("[worker] task-complete", {
          iteration,
          taskName: task.name,
          processed,
          taskMs,
        });

        processedCount += processed;
      } catch (error) {
        const details = parseLoopError(error);

        console.error("[worker] task-failed", {
          iteration,
          taskName: task.name,
          taskMs: Date.now() - taskStartedAtMs,
          errorMessage: details.message,
          errorStack: details.stack,
        });
      }
    }

    const loopMs = Date.now() - loopStartedAtMs;

    console.log("[worker] loop-complete", {
      iteration,
      processedCount,
      loopMs,
    });

    if (processedCount === 0) {
      console.log("[worker] idle-wait", {
        iteration,
        sleepMs: options.idleDelayMs,
      });
      await wait(options.idleDelayMs);
    }
  }
};
