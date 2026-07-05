import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Rating } from "ts-fsrs";
import {
  buildOptimizationReadiness,
  buildOptimizerReviewSequences,
  loadCompleteDeckReviewLogs,
  type CompleteReviewLog,
} from "../koala/fsrs/optimizer.ts";
import {
  DEFAULT_SCHEDULER_FLAGS,
  REVIEW_LOG_COVERAGE_COMPLETE,
  REVIEW_LOG_COVERAGE_PARTIAL,
  TS_FSRS_VERSION,
} from "../koala/fsrs/constants.ts";
import {
  buildDefaultFsrsParameters,
  serializeFsrsParameters,
  type SerializedDeckScheduler,
} from "../koala/fsrs/scheduler.ts";
import { resolveReviewLogCoverage } from "../koala/fsrs/review-log.ts";
import { calculateSchedulingData } from "../koala/trpc-routes/calculate-scheduling-data.ts";

const now = Date.parse("2026-05-28T12:00:00.000Z");
const deckFsrsMigration = new URL(
  "../prisma/migrations/20260528090000_deck_fsrs_configs/migration.sql",
  import.meta.url,
);

function deckScheduler(
  configId: number,
  requestedRetention: number,
  weightOverride?: (weights: number[]) => number[],
): SerializedDeckScheduler {
  const parameters = serializeFsrsParameters(
    buildDefaultFsrsParameters(requestedRetention),
  );
  return {
    deckId: configId,
    configId,
    requestedRetention,
    parameters: {
      ...parameters,
      w: weightOverride ? weightOverride(parameters.w) : parameters.w,
    },
    flags: DEFAULT_SCHEDULER_FLAGS,
    tsFsrsVersion: TS_FSRS_VERSION,
    updatedAt: new Date(now + configId).toISOString(),
    cacheKey: `${configId}:${new Date(now + configId).toISOString()}`,
  };
}

const newCard = {
  difficulty: 0,
  stability: 0,
  lastReview: 0,
  lapses: 0,
  repetitions: 0,
  nextReview: 0,
};

function completeReviewLog(input: {
  id: number;
  cardId: number;
  reviewOffsetMs: number;
  rating: Rating;
  elapsedDays: number;
}): CompleteReviewLog {
  return {
    id: BigInt(input.id),
    cardId: input.cardId,
    reviewAt: new Date(now + input.reviewOffsetMs),
    rating: input.rating,
    elapsedDays: input.elapsedDays,
  };
}

test("deck FSRS migration backfills one config per deck from user defaults", async () => {
  const migrationSql = await readFile(deckFsrsMigration, "utf8");

  assert.match(migrationSql, /INSERT INTO "DeckFsrsConfig"/);
  assert.match(migrationSql, /FROM "Deck"/);
  assert.match(
    migrationSql,
    /LEFT JOIN "UserSettings" ON "UserSettings"\."userId" = "Deck"\."userId"/,
  );
  assert.match(
    migrationSql,
    /COALESCE\("UserSettings"\."requestedRetention", 0\.73\)/,
  );
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "DeckFsrsConfig_deckId_key" ON "DeckFsrsConfig"\("deckId"\)/,
  );
});

test("deck-owned scheduler preserves legacy scheduling for generated parameters", () => {
  const requestedRetention = 0.82;
  const legacy = calculateSchedulingData(
    newCard,
    Rating.Good,
    now,
    requestedRetention,
  );
  const deckOwned = calculateSchedulingData(
    newCard,
    Rating.Good,
    now,
    deckScheduler(10, requestedRetention),
  );

  assert.deepEqual(deckOwned, legacy);
});

test("deck scheduler cache separates decks with different parameters", () => {
  const baseline = calculateSchedulingData(
    newCard,
    Rating.Good,
    now,
    deckScheduler(20, 0.73),
  );
  const tuned = calculateSchedulingData(
    newCard,
    Rating.Good,
    now,
    deckScheduler(21, 0.73, (weights) => {
      const next = [...weights];
      next[2] = next[2] * 2;
      return next;
    }),
  );

  assert.notEqual(tuned.nextReview, baseline.nextReview);
});

test("review-log coverage distinguishes complete new histories from partial legacy histories", () => {
  const reviewAt = new Date(now);
  const complete = resolveReviewLogCoverage(
    {
      createdAt: new Date(now),
      firstReview: 0,
      lastReview: 0,
      lapses: 0,
      repetitions: 0,
      reviewLogCoverage: null,
      reviewLogStartedAt: null,
    },
    reviewAt,
  );
  const partial = resolveReviewLogCoverage(
    {
      createdAt: new Date(now - 86_400_000),
      firstReview: now - 1000,
      lastReview: now - 1000,
      lapses: 0,
      repetitions: 1,
      reviewLogCoverage: null,
      reviewLogStartedAt: null,
    },
    reviewAt,
  );
  const existingStart = new Date(now - 5000);
  const existing = resolveReviewLogCoverage(
    {
      createdAt: new Date(now - 86_400_000),
      firstReview: now - 1000,
      lastReview: now - 1000,
      lapses: 0,
      repetitions: 1,
      reviewLogCoverage: REVIEW_LOG_COVERAGE_COMPLETE,
      reviewLogStartedAt: existingStart,
    },
    reviewAt,
  );

  assert.equal(complete.completeness, REVIEW_LOG_COVERAGE_COMPLETE);
  assert.equal(complete.reviewLogStartedAt, reviewAt);
  assert.equal(partial.completeness, REVIEW_LOG_COVERAGE_PARTIAL);
  assert.equal(partial.reviewLogStartedAt, reviewAt);
  assert.equal(existing.completeness, REVIEW_LOG_COVERAGE_COMPLETE);
  assert.equal(existing.reviewLogStartedAt, existingStart);
});

test("optimizer readiness counts complete logs and unique cards", () => {
  const logs: CompleteReviewLog[] = Array.from(
    { length: 250 },
    (_, i) => ({
      id: BigInt(i + 1),
      cardId: (i % 50) + 1,
      reviewAt: new Date(now + i),
      rating: Rating.Good,
      elapsedDays: i % 3,
    }),
  );

  const readiness = buildOptimizationReadiness({
    logs,
    logsSinceOptimize: 250,
    lastOptimizedAt: new Date(now - 15 * 86_400_000),
    now: new Date(now),
  });

  assert.equal(readiness.isEligible, true);
  assert.equal(readiness.reason, "eligible");
  assert.equal(readiness.completeLogCount, 250);
  assert.equal(readiness.completeCardCount, 50);
});

test("optimizer groups complete logs into complete per-card training histories", () => {
  const logs: CompleteReviewLog[] = [
    {
      id: BigInt(1),
      cardId: 1,
      reviewAt: new Date(now),
      rating: Rating.Good,
      elapsedDays: 0,
    },
    {
      id: BigInt(2),
      cardId: 2,
      reviewAt: new Date(now + 1000),
      rating: Rating.Hard,
      elapsedDays: 0,
    },
    {
      id: BigInt(3),
      cardId: 1,
      reviewAt: new Date(now + 86_400_000),
      rating: Rating.Easy,
      elapsedDays: 1,
    },
    {
      id: BigInt(4),
      cardId: 1,
      reviewAt: new Date(now + 3 * 86_400_000),
      rating: Rating.Again,
      elapsedDays: 2,
    },
  ];

  assert.deepEqual(buildOptimizerReviewSequences(logs), [
    [
      { rating: Rating.Good, deltaT: 0 },
      { rating: Rating.Easy, deltaT: 1 },
    ],
    [
      { rating: Rating.Good, deltaT: 0 },
      { rating: Rating.Easy, deltaT: 1 },
      { rating: Rating.Again, deltaT: 2 },
    ],
  ]);
});

test("optimizer skips training histories without a positive review interval", () => {
  const logs: CompleteReviewLog[] = [
    completeReviewLog({
      id: 1,
      cardId: 1,
      reviewOffsetMs: 0,
      rating: Rating.Good,
      elapsedDays: 0,
    }),
    completeReviewLog({
      id: 2,
      cardId: 1,
      reviewOffsetMs: 1000,
      rating: Rating.Hard,
      elapsedDays: 0,
    }),
    completeReviewLog({
      id: 3,
      cardId: 2,
      reviewOffsetMs: 2000,
      rating: Rating.Good,
      elapsedDays: 0,
    }),
    completeReviewLog({
      id: 4,
      cardId: 2,
      reviewOffsetMs: 86_400_000,
      rating: Rating.Easy,
      elapsedDays: 1,
    }),
  ];

  assert.deepEqual(buildOptimizerReviewSequences(logs), [
    [
      { rating: Rating.Good, deltaT: 0 },
      { rating: Rating.Easy, deltaT: 1 },
    ],
  ]);
});

test("optimizer review-log query filters to complete logs in the target deck", async () => {
  let capturedWhere: unknown;
  const client = {
    cardReviewLog: {
      findMany: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return [];
      },
    },
  };

  await loadCompleteDeckReviewLogs(client as never, 123);

  assert.deepEqual(capturedWhere, {
    deckId: 123,
    completeness: REVIEW_LOG_COVERAGE_COMPLETE,
  });
});
