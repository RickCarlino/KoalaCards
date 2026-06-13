import { Rating, type Grade } from "ts-fsrs";
import { prismaClient } from "../prisma-client.ts";
import { Card } from "@prisma/client";
import { timeUntil } from "../time-until.ts";
import { resolveDeckScheduler } from "../fsrs/scheduler.ts";
import {
  resolveReviewLogCoverage,
  serializeFsrsCard,
  serializeFsrsReviewLog,
} from "../fsrs/review-log.ts";
import { REVIEW_LOG_COVERAGE_COMPLETE } from "../fsrs/constants.ts";
import { optimizeDeckFsrs } from "../fsrs/optimizer.ts";
import { calculateSchedulingReview } from "./calculate-scheduling-data.ts";

type CardGradingFields =
  | "difficulty"
  | "firstReview"
  | "id"
  | "createdAt"
  | "deckId"
  | "lapses"
  | "lastReview"
  | "nextReview"
  | "repetitions"
  | "reviewLogCoverage"
  | "reviewLogStartedAt"
  | "stability";

type GradedCard = Pick<Card, CardGradingFields> & {
  userId: string;
};

type SetGradeTestHooks = {
  beforeReviewLogCreate?: () => Promise<void>;
};

const shouldPauseForLapses = (
  maxLapses: number | undefined,
  lapses: number,
) => {
  if (!maxLapses || maxLapses <= 0) {
    return false;
  }
  return lapses >= maxLapses;
};

export async function setGrade(
  card: GradedCard,
  grade: Grade,
  now = Date.now(),
  maxLapses?: number,
  testHooks?: SetGradeTestHooks,
) {
  const isFail = grade === Rating.Again;
  const nextLapses = (card.lapses || 0) + (isFail ? 1 : 0);
  const pauseForLapses = shouldPauseForLapses(maxLapses, nextLapses);
  const reviewAt = new Date(now);

  const { id, nextReview } = await prismaClient.$transaction(
    async (tx) => {
      const scheduler = await resolveDeckScheduler(
        { userId: card.userId, deckId: card.deckId },
        tx,
      );
      const scheduling = calculateSchedulingReview(
        card,
        grade,
        now,
        scheduler,
      );
      const coverage = resolveReviewLogCoverage(card, reviewAt);
      const data = {
        ...card,
        ...scheduling,
        repetitions: (card.repetitions || 0) + 1,
        lastReview: now,
        firstReview: card.firstReview || now,
        lastFailure: isFail ? now : 0,
        lapses: nextLapses,
      };

      const updatedCard = await tx.card.update({
        where: { id: card.id, userId: card.userId },
        data: {
          lastFailure: data.lastFailure,
          difficulty: data.difficulty,
          lapses: data.lapses,
          repetitions: data.repetitions,
          stability: data.stability,
          firstReview: data.firstReview,
          lastReview: data.lastReview,
          nextReview: data.nextReview,
          reviewLogCoverage: coverage.completeness,
          reviewLogStartedAt: coverage.reviewLogStartedAt,
          ...(pauseForLapses ? { paused: true } : {}),
        },
        select: { id: true, nextReview: true },
      });

      await testHooks?.beforeReviewLogCreate?.();

      await tx.cardReviewLog.create({
        data: {
          userId: card.userId,
          deckId: card.deckId,
          deckFsrsConfigId: scheduler.configId,
          cardId: card.id,
          reviewAt,
          rating: grade,
          completeness: coverage.completeness,
          rawLogJson: serializeFsrsReviewLog(scheduling.rawLog),
          cardBeforeJson: serializeFsrsCard(scheduling.fsrsCardBefore),
          cardAfterJson: serializeFsrsCard(scheduling.fsrsCardAfter),
          dueAt: scheduling.dueAt,
          scheduledDays: scheduling.scheduledDays,
          elapsedDays: scheduling.elapsedDays,
          stabilityBefore: scheduling.stabilityBefore,
          stabilityAfter: scheduling.stabilityAfter,
          difficultyBefore: scheduling.difficultyBefore,
          difficultyAfter: scheduling.difficultyAfter,
          tsFsrsVersion: scheduler.tsFsrsVersion,
        },
      });

      if (coverage.completeness === REVIEW_LOG_COVERAGE_COMPLETE) {
        await tx.deckFsrsConfig.update({
          where: { id: scheduler.configId },
          data: {
            eligibleLogCount: { increment: 1 },
            logsSinceOptimize: { increment: 1 },
          },
        });
      }

      return updatedCard;
    },
  );
  void optimizeDeckFsrs({
    userId: card.userId,
    deckId: card.deckId,
  }).catch((error) => {
    console.error("Deck FSRS optimization trigger failed:", error);
  });
  console.log(`Card ${id} next review: ${timeUntil(nextReview)}`);
}
