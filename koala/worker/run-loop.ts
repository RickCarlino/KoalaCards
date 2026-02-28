export type WorkerTask = {
  name: string;
  runOnce: () => Promise<number>;
};

type WorkerLoopOptions = {
  tasks: WorkerTask[];
  idleDelayMs: number;
};

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const taskErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unknown worker error.";
};

export const runWorkerLoop = async (
  options: WorkerLoopOptions,
): Promise<void> => {
  const shouldContinue = true;

  while (shouldContinue) {
    let processedCount = 0;

    for (const task of options.tasks) {
      try {
        const processed = await task.runOnce();
        if (processed > 0) {
          console.log(`[worker] ${task.name}: processed ${processed}`);
        }
        processedCount += processed;
      } catch (error) {
        console.error(`[worker] ${task.name}: ${taskErrorMessage(error)}`);
      }
    }

    if (processedCount === 0) {
      await wait(options.idleDelayMs);
    }
  }
};
