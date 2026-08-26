import { Prisma, type Card } from "@/koala/generated/prisma/client";
import type { Card as FsrsCard, CardInput, ReviewLog } from "ts-fsrs";
import {
  FSRS_REVIEW_LOG_CUTOFF,
  REVIEW_LOG_COVERAGE_COMPLETE,
  REVIEW_LOG_COVERAGE_PARTIAL,
} from "./constants.ts";

type CoverageCard = Pick<
  Card,
  | "firstReview"
  | "createdAt"
  | "lastReview"
  | "lapses"
  | "repetitions"
  | "reviewLogCoverage"
  | "reviewLogStartedAt"
>;

export type ReviewLogCoverage = {
  completeness:
    | typeof REVIEW_LOG_COVERAGE_COMPLETE
    | typeof REVIEW_LOG_COVERAGE_PARTIAL;
  reviewLogStartedAt: Date;
};

function hasPriorReviewHistory(card: CoverageCard): boolean {
  return (
    (card.repetitions || 0) + (card.lapses || 0) > 0 ||
    (card.firstReview || 0) > 0 ||
    (card.lastReview || 0) > 0
  );
}

export function resolveReviewLogCoverage(
  card: CoverageCard,
  reviewAt: Date,
): ReviewLogCoverage {
  if (
    card.reviewLogCoverage === REVIEW_LOG_COVERAGE_COMPLETE ||
    card.reviewLogCoverage === REVIEW_LOG_COVERAGE_PARTIAL
  ) {
    return {
      completeness: card.reviewLogCoverage,
      reviewLogStartedAt: card.reviewLogStartedAt ?? reviewAt,
    };
  }

  const isPostCutoffCard = card.createdAt >= FSRS_REVIEW_LOG_CUTOFF;
  if (isPostCutoffCard && !hasPriorReviewHistory(card)) {
    return {
      completeness: REVIEW_LOG_COVERAGE_COMPLETE,
      reviewLogStartedAt: reviewAt,
    };
  }

  return {
    completeness: hasPriorReviewHistory(card)
      ? REVIEW_LOG_COVERAGE_PARTIAL
      : REVIEW_LOG_COVERAGE_COMPLETE,
    reviewLogStartedAt: reviewAt,
  };
}

function serializeDate(value: Date | number | string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeFsrsReviewLog(
  log: ReviewLog,
): Prisma.InputJsonObject {
  return {
    rating: log.rating,
    state: log.state,
    due: serializeDate(log.due),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    last_elapsed_days: log.last_elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    review: serializeDate(log.review),
  };
}

export function serializeFsrsCard(
  card: CardInput | FsrsCard,
): Prisma.InputJsonObject {
  return {
    due: serializeDate(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: serializeDate(card.last_review),
  };
}
