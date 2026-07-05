import { Prisma } from "@prisma/client";
import {
  REVIEW_LOG_COVERAGE_COMPLETE,
  OPTIMIZATION_COOLDOWN_DAYS,
  OPTIMIZATION_MIN_COMPLETE_CARDS,
  OPTIMIZATION_MIN_COMPLETE_LOGS,
  OPTIMIZATION_MIN_NEW_COMPLETE_LOGS,
} from "./constants.ts";
import {
  ensureDeckFsrsConfig,
  fsrsParametersJson,
  validateFsrsParameters,
  validateSchedulerFlags,
} from "./scheduler.ts";
import { prismaClient } from "../prisma-client.ts";

type OptimizerClient = Pick<
  Prisma.TransactionClient,
  "cardReviewLog" | "deckFsrsConfig"
>;

export type CompleteReviewLog = {
  id: bigint;
  cardId: number;
  reviewAt: Date;
  rating: number;
  elapsedDays: number | null;
};

export type DeckOptimizationReadiness = {
  completeLogCount: number;
  completeCardCount: number;
  logsSinceOptimize: number;
  isEligible: boolean;
  reason:
    | "eligible"
    | "not_enough_logs"
    | "not_enough_cards"
    | "not_enough_new_logs"
    | "cooldown";
};

export type DeckOptimizationResult = {
  status: "succeeded" | "skipped" | "failed";
  readiness: DeckOptimizationReadiness;
  eligibleLogCount: number;
};

type OptimizerBinding = {
  createReview: (rating: number, deltaT: number) => unknown;
  createItem: (reviews: unknown[]) => unknown;
  computeParameters: (
    trainSet: unknown[],
    options: {
      enableShortTerm: boolean;
      numRelearningSteps: number;
      timeout: number;
    },
  ) => Promise<number[]>;
};

function toOptimizerBinding(
  binding: typeof import("@open-spaced-repetition/binding"),
): OptimizerBinding {
  return {
    createReview: (rating, deltaT) =>
      new binding.FSRSBindingReview(rating, deltaT),
    createItem: (reviews) =>
      new binding.FSRSBindingItem(
        reviews as ConstructorParameters<
          typeof binding.FSRSBindingItem
        >[0],
      ),
    computeParameters: (trainSet, options) =>
      binding.computeParameters(
        trainSet as Parameters<typeof binding.computeParameters>[0],
        options,
      ),
  };
}

function daysBetween(previous: Date, next: Date): number {
  return Math.max(
    0,
    Math.round((next.getTime() - previous.getTime()) / 86_400_000),
  );
}

function groupLogsByCard(logs: CompleteReviewLog[]) {
  const groups = new Map<number, CompleteReviewLog[]>();
  for (const log of logs) {
    const group = groups.get(log.cardId) ?? [];
    group.push(log);
    groups.set(log.cardId, group);
  }
  return [...groups.values()].map((group) =>
    group.sort((a, b) => a.reviewAt.getTime() - b.reviewAt.getTime()),
  );
}

export type OptimizerReview = {
  rating: number;
  deltaT: number;
};

function hasPositiveReviewInterval(reviews: OptimizerReview[]): boolean {
  return reviews.some((review) => review.deltaT > 0);
}

export function buildOptimizerReviewSequences(
  logs: CompleteReviewLog[],
): OptimizerReview[][] {
  return groupLogsByCard(logs).flatMap((cardLogs) => {
    let previousReviewAt: Date | null = null;
    const reviews: OptimizerReview[] = [];
    const sequences: OptimizerReview[][] = [];

    for (const log of cardLogs) {
      const deltaT =
        typeof log.elapsedDays === "number"
          ? Math.max(0, Math.round(log.elapsedDays))
          : previousReviewAt
            ? daysBetween(previousReviewAt, log.reviewAt)
            : 0;
      previousReviewAt = log.reviewAt;
      reviews.push({ rating: log.rating, deltaT });

      if (reviews.length > 1 && hasPositiveReviewInterval(reviews)) {
        sequences.push([...reviews]);
      }
    }

    return sequences;
  });
}

function newestReviewLogId(logs: CompleteReviewLog[]): bigint | null {
  return logs.reduce<bigint | null>((newestId, log) => {
    return newestId === null || log.id > newestId ? log.id : newestId;
  }, null);
}

export async function loadCompleteDeckReviewLogs(
  client: OptimizerClient,
  deckId: number,
): Promise<CompleteReviewLog[]> {
  return client.cardReviewLog.findMany({
    where: {
      deckId,
      completeness: REVIEW_LOG_COVERAGE_COMPLETE,
    },
    select: {
      id: true,
      cardId: true,
      reviewAt: true,
      rating: true,
      elapsedDays: true,
    },
    orderBy: [{ cardId: "asc" }, { reviewAt: "asc" }],
  });
}

export function buildOptimizationReadiness(input: {
  logs: CompleteReviewLog[];
  logsSinceOptimize: number;
  lastOptimizedAt: Date | null;
  now: Date;
}): DeckOptimizationReadiness {
  const completeLogCount = input.logs.length;
  const completeCardCount = groupLogsByCard(input.logs).length;
  const cooldownMs = OPTIMIZATION_COOLDOWN_DAYS * 86_400_000;
  const inCooldown =
    input.lastOptimizedAt !== null &&
    input.now.getTime() - input.lastOptimizedAt.getTime() < cooldownMs;

  if (completeLogCount < OPTIMIZATION_MIN_COMPLETE_LOGS) {
    return {
      completeLogCount,
      completeCardCount,
      logsSinceOptimize: input.logsSinceOptimize,
      isEligible: false,
      reason: "not_enough_logs",
    };
  }

  if (completeCardCount < OPTIMIZATION_MIN_COMPLETE_CARDS) {
    return {
      completeLogCount,
      completeCardCount,
      logsSinceOptimize: input.logsSinceOptimize,
      isEligible: false,
      reason: "not_enough_cards",
    };
  }

  if (input.logsSinceOptimize < OPTIMIZATION_MIN_NEW_COMPLETE_LOGS) {
    return {
      completeLogCount,
      completeCardCount,
      logsSinceOptimize: input.logsSinceOptimize,
      isEligible: false,
      reason: "not_enough_new_logs",
    };
  }

  if (inCooldown) {
    return {
      completeLogCount,
      completeCardCount,
      logsSinceOptimize: input.logsSinceOptimize,
      isEligible: false,
      reason: "cooldown",
    };
  }

  return {
    completeLogCount,
    completeCardCount,
    logsSinceOptimize: input.logsSinceOptimize,
    isEligible: true,
    reason: "eligible",
  };
}

export async function optimizeDeckFsrs(input: {
  userId: string;
  deckId: number;
  force?: boolean;
  now?: Date;
  binding?: OptimizerBinding;
}): Promise<DeckOptimizationResult> {
  const now = input.now ?? new Date();
  const config = await ensureDeckFsrsConfig(prismaClient, input);
  const logs = await loadCompleteDeckReviewLogs(
    prismaClient,
    input.deckId,
  );
  const readiness = buildOptimizationReadiness({
    logs,
    logsSinceOptimize: config.logsSinceOptimize,
    lastOptimizedAt: config.lastOptimizedAt,
    now,
  });

  if (!input.force && !readiness.isEligible) {
    await prismaClient.deckFsrsConfig.update({
      where: { id: config.id },
      data: {
        eligibleLogCount: readiness.completeLogCount,
        optimizerStatus: "idle",
      },
    });
    return {
      status: "skipped",
      readiness,
      eligibleLogCount: readiness.completeLogCount,
    };
  }

  try {
    const sequences = buildOptimizerReviewSequences(logs);
    if (sequences.length === 0) {
      await prismaClient.deckFsrsConfig.update({
        where: { id: config.id },
        data: {
          eligibleLogCount: readiness.completeLogCount,
          optimizerStatus: "failed",
          optimizerError:
            "No trainable FSRS review histories with positive intervals.",
        },
      });
      return {
        status: "failed",
        readiness,
        eligibleLogCount: readiness.completeLogCount,
      };
    }

    const binding =
      input.binding ??
      toOptimizerBinding(await import("@open-spaced-repetition/binding"));
    const items = sequences.map((sequence) => {
      return binding.createItem(
        sequence.map((review) =>
          binding.createReview(review.rating, review.deltaT),
        ),
      );
    });
    const flags = validateSchedulerFlags(config.schedulerFlagsJson);
    const optimizedWeights = await binding.computeParameters(items, {
      enableShortTerm: flags.enable_short_term,
      numRelearningSteps: flags.enable_short_term ? 1 : 0,
      timeout: 1000,
    });
    const currentParameters = validateFsrsParameters(
      config.parametersJson,
    );
    const parameters = validateFsrsParameters({
      ...currentParameters,
      w: optimizedWeights,
      request_retention: config.requestedRetention,
      ...flags,
    });
    await prismaClient.deckFsrsConfig.update({
      where: { id: config.id },
      data: {
        parametersJson: fsrsParametersJson(parameters),
        parametersSource: "optimized",
        lastOptimizedAt: now,
        lastOptimizedLogId: newestReviewLogId(logs),
        logsSinceOptimize: 0,
        eligibleLogCount: readiness.completeLogCount,
        optimizerStatus: "succeeded",
        optimizerError: null,
      },
    });

    return {
      status: "succeeded",
      readiness,
      eligibleLogCount: readiness.completeLogCount,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown optimization error";
    await prismaClient.deckFsrsConfig.update({
      where: { id: config.id },
      data: {
        eligibleLogCount: readiness.completeLogCount,
        optimizerStatus: "failed",
        optimizerError: message.slice(0, 1000),
      },
    });
    return {
      status: "failed",
      readiness,
      eligibleLogCount: readiness.completeLogCount,
    };
  }
}
