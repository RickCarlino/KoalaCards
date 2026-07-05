import test from "node:test";
import assert from "node:assert/strict";
import { Rating } from "ts-fsrs";
import { prismaClient } from "../koala/prisma-client.ts";
import { getDueCardsCount } from "../koala/due-cards.ts";
import {
  REVIEW_LOG_COVERAGE_COMPLETE,
  REVIEW_LOG_COVERAGE_PARTIAL,
} from "../koala/fsrs/constants.ts";
import {
  buildDefaultFsrsParameters,
  ensureDeckFsrsConfig,
  fsrsParametersJson,
  resolveDeckScheduler,
} from "../koala/fsrs/scheduler.ts";
import {
  loadCompleteDeckReviewLogs,
  optimizeDeckFsrs,
} from "../koala/fsrs/optimizer.ts";
import { calculateSchedulingData } from "../koala/trpc-routes/calculate-scheduling-data.ts";
import { setGrade } from "../koala/trpc-routes/import-cards.ts";
import { appRouter } from "../koala/trpc-routes/main.ts";

const runId = `fsrs-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function createUser() {
  const user = await prismaClient.user.create({
    data: {
      id: `${runId}-user-${Math.random().toString(36).slice(2)}`,
      email: `${runId}-${Math.random().toString(36).slice(2)}@example.test`,
      userSettings: {
        create: {
          requestedRetention: 0.81,
        },
      },
    },
  });
  return user;
}

async function createDeck(userId: string, name: string) {
  const deck = await prismaClient.deck.create({
    data: { userId, name },
  });
  await ensureDeckFsrsConfig(prismaClient, {
    userId,
    deckId: deck.id,
  });
  return deck;
}

async function createCard(input: {
  userId: string;
  deckId: number;
  term: string;
  firstReview?: number;
  lastReview?: number;
  nextReview?: number;
  repetitions?: number;
  createdAt?: Date;
}) {
  return prismaClient.card.create({
    data: {
      userId: input.userId,
      deckId: input.deckId,
      term: input.term,
      definition: `${input.term} definition`,
      firstReview: input.firstReview ?? 0,
      lastReview: input.lastReview ?? 0,
      nextReview: input.nextReview ?? 0,
      repetitions: input.repetitions ?? 0,
      lapses: 0,
      stability: 0,
      difficulty: 0,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

async function seedCompleteReviewLogs(input: {
  userId: string;
  deckId: number;
  deckFsrsConfigId: number;
  cardPrefix: string;
  cardCount: number;
  logsPerCard: number;
  elapsedDays?: (reviewIndex: number) => number;
}) {
  const cards = await Promise.all(
    Array.from({ length: input.cardCount }, (_, index) =>
      createCard({
        userId: input.userId,
        deckId: input.deckId,
        term: `${input.cardPrefix}-${index}`,
      }),
    ),
  );
  const baseReviewAt = Date.parse("2026-05-28T00:00:00.000Z");
  await prismaClient.cardReviewLog.createMany({
    data: cards.flatMap((card, cardIndex) =>
      Array.from({ length: input.logsPerCard }, (_, reviewIndex) => {
        const reviewAt = new Date(
          baseReviewAt +
            (cardIndex * input.logsPerCard + reviewIndex) * 86_400_000,
        );
        return {
          userId: input.userId,
          deckId: input.deckId,
          deckFsrsConfigId: input.deckFsrsConfigId,
          cardId: card.id,
          reviewAt,
          rating: ((cardIndex + reviewIndex) % 4) + 1,
          completeness: REVIEW_LOG_COVERAGE_COMPLETE,
          rawLogJson: {},
          cardBeforeJson: {},
          cardAfterJson: {},
          dueAt: reviewAt,
          scheduledDays: reviewIndex,
          elapsedDays: input.elapsedDays
            ? input.elapsedDays(reviewIndex)
            : reviewIndex === 0
              ? 0
              : Math.max(1, reviewIndex),
          stabilityBefore: 0,
          stabilityAfter: 1 + reviewIndex,
          difficultyBefore: 0,
          difficultyAfter: 1 + reviewIndex,
          tsFsrsVersion: "5.4.0",
        };
      }),
    ),
  });
}

test.after(async () => {
  await prismaClient.user.deleteMany({
    where: { id: { startsWith: `${runId}-user-` } },
  });
  await prismaClient.$disconnect();
});

test("setGrade updates aggregate scheduling fields and appends a complete review log atomically", async () => {
  const user = await createUser();
  const deck = await createDeck(user.id, `${runId}-complete`);
  const card = await createCard({
    userId: user.id,
    deckId: deck.id,
    term: `${runId}-complete-card`,
  });
  const now = Date.parse("2026-05-28T18:00:00.000Z");

  await setGrade(card, Rating.Good, now);

  const updatedCard = await prismaClient.card.findUniqueOrThrow({
    where: { id: card.id },
  });
  const logs = await prismaClient.cardReviewLog.findMany({
    where: { cardId: card.id },
  });
  const config = await prismaClient.deckFsrsConfig.findUniqueOrThrow({
    where: { deckId: deck.id },
  });

  assert.equal(updatedCard.firstReview, now);
  assert.equal(updatedCard.lastReview, now);
  assert.equal(updatedCard.repetitions, 1);
  assert.equal(
    updatedCard.reviewLogCoverage,
    REVIEW_LOG_COVERAGE_COMPLETE,
  );
  assert.equal(updatedCard.reviewLogStartedAt?.getTime(), now);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].deckId, deck.id);
  assert.equal(logs[0].deckFsrsConfigId, config.id);
  assert.equal(logs[0].completeness, REVIEW_LOG_COVERAGE_COMPLETE);
  assert.equal(config.eligibleLogCount, 1);
  assert.equal(config.logsSinceOptimize, 1);
});

test("createDeck route creates exactly one deck scheduler config from user defaults", async () => {
  const user = await createUser();
  const caller = appRouter.createCaller({
    session: {} as never,
    user,
  });

  const created = await caller.createDeck({
    name: `${runId}-route-created`,
    langCode: "ko",
  });
  const duplicate = await caller.createDeck({
    name: `${runId}-route-created`,
    langCode: "ko",
  });

  const configs = await prismaClient.deckFsrsConfig.findMany({
    where: { deckId: created.id },
  });

  assert.equal(duplicate.id, created.id);
  assert.equal(configs.length, 1);
  assert.equal(configs[0].requestedRetention, 0.81);
  assert.equal(configs[0].parametersSource, "default");
  assert.equal(configs[0].optimizerStatus, "idle");
  assert.equal(configs[0].eligibleLogCount, 0);
  assert.equal(configs[0].logsSinceOptimize, 0);
});

test("failed card update does not leave an orphan review log", async () => {
  const user = await createUser();
  const deck = await createDeck(user.id, `${runId}-missing-card`);
  const missingCardId = 2_000_000_000;

  await assert.rejects(
    () =>
      setGrade(
        {
          id: missingCardId,
          userId: user.id,
          deckId: deck.id,
          createdAt: new Date(),
          difficulty: 0,
          stability: 0,
          firstReview: 0,
          lastReview: 0,
          nextReview: 0,
          lapses: 0,
          repetitions: 0,
          reviewLogCoverage: null,
          reviewLogStartedAt: null,
        },
        Rating.Good,
        Date.parse("2026-05-28T19:00:00.000Z"),
      ),
    /Record to update not found|No 'Card' record/,
  );

  const orphanLogs = await prismaClient.cardReviewLog.count({
    where: { cardId: missingCardId },
  });
  assert.equal(orphanLogs, 0);
});

test("transaction failure after card update rolls back aggregate scheduling fields", async () => {
  const user = await createUser();
  const deck = await createDeck(user.id, `${runId}-rollback-after-card`);
  const card = await createCard({
    userId: user.id,
    deckId: deck.id,
    term: `${runId}-rollback-after-card`,
  });
  const now = Date.parse("2026-05-28T19:30:00.000Z");

  await assert.rejects(
    () =>
      setGrade(card, Rating.Good, now, undefined, {
        beforeReviewLogCreate: async () => {
          throw new Error("simulated log insert failure");
        },
      }),
    /simulated log insert failure/,
  );

  const unchangedCard = await prismaClient.card.findUniqueOrThrow({
    where: { id: card.id },
  });
  const logs = await prismaClient.cardReviewLog.count({
    where: { cardId: card.id },
  });

  assert.equal(unchangedCard.firstReview, 0);
  assert.equal(unchangedCard.lastReview, 0);
  assert.equal(unchangedCard.repetitions, 0);
  assert.equal(unchangedCard.reviewLogCoverage, null);
  assert.equal(logs, 0);
});

test("legacy cards produce partial logs and do not increment complete-log counters", async () => {
  const user = await createUser();
  const deck = await createDeck(user.id, `${runId}-partial`);
  const oldReview = Date.parse("2026-05-20T00:00:00.000Z");
  const card = await createCard({
    userId: user.id,
    deckId: deck.id,
    term: `${runId}-partial-card`,
    firstReview: oldReview,
    lastReview: oldReview,
    nextReview: Date.parse("2026-05-21T00:00:00.000Z"),
    repetitions: 1,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
  });
  const now = Date.parse("2026-05-28T20:00:00.000Z");

  await setGrade(card, Rating.Hard, now);

  const updatedCard = await prismaClient.card.findUniqueOrThrow({
    where: { id: card.id },
  });
  const log = await prismaClient.cardReviewLog.findFirstOrThrow({
    where: { cardId: card.id },
  });
  const config = await prismaClient.deckFsrsConfig.findUniqueOrThrow({
    where: { deckId: deck.id },
  });

  assert.equal(updatedCard.reviewLogCoverage, REVIEW_LOG_COVERAGE_PARTIAL);
  assert.equal(updatedCard.reviewLogStartedAt?.getTime(), now);
  assert.equal(log.completeness, REVIEW_LOG_COVERAGE_PARTIAL);
  assert.equal(config.eligibleLogCount, 0);
  assert.equal(config.logsSinceOptimize, 0);
});

test("deck export and import preserve aggregate scheduling fields and ensure target config", async () => {
  const exportingUser = await createUser();
  const importingUser = await createUser();
  const sourceDeck = await createDeck(
    exportingUser.id,
    `${runId}-export-source`,
  );
  const targetDeck = await prismaClient.deck.create({
    data: {
      userId: importingUser.id,
      name: `${runId}-import-target`,
    },
  });
  const sourceCard = await createCard({
    userId: exportingUser.id,
    deckId: sourceDeck.id,
    term: `${runId}-export-card`,
    firstReview: 101,
    lastReview: 202,
    nextReview: 303,
    repetitions: 4,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
  });
  await prismaClient.card.update({
    where: { id: sourceCard.id },
    data: {
      paused: true,
      stability: 5,
      difficulty: 6,
      lapses: 7,
      lastFailure: 808,
    },
  });
  const exportCaller = appRouter.createCaller({
    session: {} as never,
    user: exportingUser,
  });
  const importCaller = appRouter.createCaller({
    session: {} as never,
    user: importingUser,
  });

  const payload = await exportCaller.exportDeck({
    deckId: sourceDeck.id,
  });
  const result = await importCaller.importDeck({
    deckId: targetDeck.id,
    payload,
  });

  const importedCard = await prismaClient.card.findFirstOrThrow({
    where: {
      userId: importingUser.id,
      deckId: targetDeck.id,
      term: sourceCard.term,
    },
  });
  const targetConfig = await prismaClient.deckFsrsConfig.findUnique({
    where: { deckId: targetDeck.id },
  });
  const importedLogs = await prismaClient.cardReviewLog.count({
    where: { cardId: importedCard.id },
  });

  assert.equal(result.importedCount, 1);
  assert.equal(importedCard.paused, true);
  assert.equal(importedCard.stability, 5);
  assert.equal(importedCard.difficulty, 6);
  assert.equal(importedCard.firstReview, 101);
  assert.equal(importedCard.lastReview, 202);
  assert.equal(importedCard.nextReview, 303);
  assert.equal(importedCard.repetitions, 4);
  assert.equal(importedCard.lapses, 7);
  assert.equal(importedCard.lastFailure, 808);
  assert.ok(targetConfig);
  assert.equal(targetConfig?.requestedRetention, 0.81);
  assert.equal(importedLogs, 0);
});

test("due counts are deck-scoped for normal and remedial cards", async () => {
  const user = await createUser();
  const deckA = await createDeck(user.id, `${runId}-due-a`);
  const deckB = await createDeck(user.id, `${runId}-due-b`);
  await createCard({
    userId: user.id,
    deckId: deckA.id,
    term: `${runId}-deck-a-routine`,
    firstReview: 1,
    lastReview: 1,
    nextReview: 10,
    repetitions: 1,
  });
  const remedialA = await createCard({
    userId: user.id,
    deckId: deckA.id,
    term: `${runId}-deck-a-remedial`,
  });
  await prismaClient.card.update({
    where: { id: remedialA.id },
    data: { lastFailure: 20 },
  });
  const remedialB = await createCard({
    userId: user.id,
    deckId: deckB.id,
    term: `${runId}-deck-b-remedial`,
  });
  await prismaClient.card.update({
    where: { id: remedialB.id },
    data: { lastFailure: 20 },
  });

  assert.equal(await getDueCardsCount(user.id, 100, deckA.id), 2);
  assert.equal(await getDueCardsCount(user.id, 100, deckB.id), 1);
});

test("deck merge keeps historical logs on source deck and future logs on destination deck", async () => {
  const user = await createUser();
  const sourceDeck = await createDeck(user.id, `${runId}-merge-source`);
  const otherDeck = await createDeck(user.id, `${runId}-merge-other`);
  const reviewedCard = await createCard({
    userId: user.id,
    deckId: sourceDeck.id,
    term: `${runId}-merge-reviewed`,
    firstReview: Date.parse("2026-05-28T00:00:00.000Z"),
    lastReview: Date.parse("2026-05-29T00:00:00.000Z"),
    nextReview: Date.parse("2026-06-01T00:00:00.000Z"),
    repetitions: 2,
  });
  await createCard({
    userId: user.id,
    deckId: otherDeck.id,
    term: `${runId}-merge-other-card`,
  });
  const sourceConfig = await prismaClient.deckFsrsConfig.findUniqueOrThrow(
    {
      where: { deckId: sourceDeck.id },
    },
  );
  await prismaClient.cardReviewLog.create({
    data: {
      userId: user.id,
      deckId: sourceDeck.id,
      deckFsrsConfigId: sourceConfig.id,
      cardId: reviewedCard.id,
      reviewAt: new Date("2026-05-29T00:00:00.000Z"),
      rating: Rating.Good,
      completeness: REVIEW_LOG_COVERAGE_COMPLETE,
      rawLogJson: {},
      cardBeforeJson: {},
      cardAfterJson: {},
      dueAt: new Date("2026-06-01T00:00:00.000Z"),
      scheduledDays: 3,
      elapsedDays: 1,
      stabilityBefore: 1,
      stabilityAfter: 2,
      difficultyBefore: 3,
      difficultyAfter: 4,
      tsFsrsVersion: "5.4.0",
    },
  });
  const caller = appRouter.createCaller({
    session: {} as never,
    user,
  });

  const result = await caller.mergeDecks({
    deckIds: [sourceDeck.id, otherDeck.id],
    newDeckName: `${runId}-merge-destination`,
  });
  const movedCard = await prismaClient.card.findUniqueOrThrow({
    where: { id: reviewedCard.id },
  });
  const destinationConfig =
    await prismaClient.deckFsrsConfig.findUniqueOrThrow({
      where: { deckId: result.newDeckId },
    });
  const targetCompleteLogs = await loadCompleteDeckReviewLogs(
    prismaClient,
    result.newDeckId,
  );

  assert.equal(movedCard.deckId, result.newDeckId);
  assert.equal(movedCard.reviewLogCoverage, REVIEW_LOG_COVERAGE_PARTIAL);
  assert.equal(movedCard.reviewLogStartedAt, null);
  assert.equal(targetCompleteLogs.length, 0);

  await setGrade(
    movedCard,
    Rating.Hard,
    Date.parse("2026-06-02T00:00:00.000Z"),
  );

  const logs = await prismaClient.cardReviewLog.findMany({
    where: { cardId: reviewedCard.id },
    orderBy: { reviewAt: "asc" },
  });

  assert.equal(logs.length, 2);
  assert.equal(logs[0].deckId, sourceDeck.id);
  assert.equal(logs[0].deckFsrsConfigId, sourceConfig.id);
  assert.equal(logs[0].completeness, REVIEW_LOG_COVERAGE_COMPLETE);
  assert.equal(logs[1].deckId, result.newDeckId);
  assert.equal(logs[1].deckFsrsConfigId, destinationConfig.id);
  assert.equal(logs[1].completeness, REVIEW_LOG_COVERAGE_PARTIAL);
});

test("future reviews use newly optimized deck parameters without mass-changing existing due dates", async () => {
  const user = await createUser();
  const deck = await createDeck(user.id, `${runId}-optimized`);
  const config = await prismaClient.deckFsrsConfig.findUniqueOrThrow({
    where: { deckId: deck.id },
  });
  const optimizedParameters = buildDefaultFsrsParameters(
    config.requestedRetention,
  );
  optimizedParameters.w = optimizedParameters.w.map((weight, index) =>
    index === 2 ? weight * 2 : weight,
  );
  await prismaClient.deckFsrsConfig.update({
    where: { id: config.id },
    data: {
      parametersJson: fsrsParametersJson(optimizedParameters),
      parametersSource: "optimized",
    },
  });

  const untouchedCard = await createCard({
    userId: user.id,
    deckId: deck.id,
    term: `${runId}-untouched-card`,
    nextReview: Date.parse("2026-06-01T00:00:00.000Z"),
  });
  const reviewedCard = await createCard({
    userId: user.id,
    deckId: deck.id,
    term: `${runId}-optimized-card`,
  });
  const now = Date.parse("2026-05-28T21:00:00.000Z");
  const scheduler = await resolveDeckScheduler({
    userId: user.id,
    deckId: deck.id,
  });
  const expected = calculateSchedulingData(
    reviewedCard,
    Rating.Good,
    now,
    scheduler,
  );

  await setGrade(reviewedCard, Rating.Good, now);

  const updatedReviewedCard = await prismaClient.card.findUniqueOrThrow({
    where: { id: reviewedCard.id },
  });
  const updatedUntouchedCard = await prismaClient.card.findUniqueOrThrow({
    where: { id: untouchedCard.id },
  });

  assert.equal(updatedReviewedCard.nextReview, expected.nextReview);
  assert.equal(updatedUntouchedCard.nextReview, untouchedCard.nextReview);
});

test("successful optimization updates only the target deck config and ignores partial logs", async () => {
  const user = await createUser();
  const targetDeck = await createDeck(user.id, `${runId}-target-optimize`);
  const otherDeck = await createDeck(user.id, `${runId}-other-optimize`);
  const targetConfig = await prismaClient.deckFsrsConfig.findUniqueOrThrow(
    {
      where: { deckId: targetDeck.id },
    },
  );
  const otherConfig = await prismaClient.deckFsrsConfig.findUniqueOrThrow({
    where: { deckId: otherDeck.id },
  });

  await seedCompleteReviewLogs({
    userId: user.id,
    deckId: targetDeck.id,
    deckFsrsConfigId: targetConfig.id,
    cardPrefix: `${runId}-target-optimize-card`,
    cardCount: 50,
    logsPerCard: 6,
  });
  await seedCompleteReviewLogs({
    userId: user.id,
    deckId: otherDeck.id,
    deckFsrsConfigId: otherConfig.id,
    cardPrefix: `${runId}-other-optimize-card`,
    cardCount: 50,
    logsPerCard: 6,
  });
  const partialCard = await createCard({
    userId: user.id,
    deckId: targetDeck.id,
    term: `${runId}-target-partial-log-card`,
  });
  await prismaClient.cardReviewLog.create({
    data: {
      userId: user.id,
      deckId: targetDeck.id,
      deckFsrsConfigId: targetConfig.id,
      cardId: partialCard.id,
      reviewAt: new Date("2026-07-01T00:00:00.000Z"),
      rating: Rating.Good,
      completeness: REVIEW_LOG_COVERAGE_PARTIAL,
      rawLogJson: {},
      cardBeforeJson: {},
      cardAfterJson: {},
      tsFsrsVersion: "5.4.0",
    },
  });
  await prismaClient.deckFsrsConfig.update({
    where: { id: targetConfig.id },
    data: {
      eligibleLogCount: 301,
      logsSinceOptimize: 300,
    },
  });
  const newestTargetCompleteLog =
    await prismaClient.cardReviewLog.findFirstOrThrow({
      where: {
        deckId: targetDeck.id,
        completeness: REVIEW_LOG_COVERAGE_COMPLETE,
      },
      orderBy: { id: "desc" },
      select: { id: true },
    });

  const result = await optimizeDeckFsrs({
    userId: user.id,
    deckId: targetDeck.id,
    now: new Date("2026-08-01T00:00:00.000Z"),
  });

  const updatedTargetConfig =
    await prismaClient.deckFsrsConfig.findUniqueOrThrow({
      where: { id: targetConfig.id },
    });
  const updatedOtherConfig =
    await prismaClient.deckFsrsConfig.findUniqueOrThrow({
      where: { id: otherConfig.id },
    });

  assert.equal(result.status, "succeeded");
  assert.equal(updatedTargetConfig.parametersSource, "optimized");
  assert.equal(updatedTargetConfig.optimizerStatus, "succeeded");
  assert.equal(updatedTargetConfig.optimizerError, null);
  assert.equal(updatedTargetConfig.logsSinceOptimize, 0);
  assert.equal(updatedTargetConfig.eligibleLogCount, 300);
  assert.ok(updatedTargetConfig.lastOptimizedAt);
  assert.equal(
    updatedTargetConfig.lastOptimizedLogId,
    newestTargetCompleteLog.id,
  );
  assert.equal(updatedOtherConfig.parametersSource, "default");
  assert.equal(updatedOtherConfig.lastOptimizedAt, null);
});

test("optimization fails before binding when histories have no positive intervals", async () => {
  const user = await createUser();
  const deck = await createDeck(
    user.id,
    `${runId}-zero-interval-optimize`,
  );
  const config = await prismaClient.deckFsrsConfig.findUniqueOrThrow({
    where: { deckId: deck.id },
  });
  await seedCompleteReviewLogs({
    userId: user.id,
    deckId: deck.id,
    deckFsrsConfigId: config.id,
    cardPrefix: `${runId}-zero-interval-card`,
    cardCount: 50,
    logsPerCard: 5,
    elapsedDays: () => 0,
  });
  await prismaClient.deckFsrsConfig.update({
    where: { id: config.id },
    data: {
      eligibleLogCount: 250,
      logsSinceOptimize: 250,
    },
  });
  let bindingCalled = false;

  const result = await optimizeDeckFsrs({
    userId: user.id,
    deckId: deck.id,
    now: new Date("2026-08-02T00:00:00.000Z"),
    binding: {
      createReview: () => {
        bindingCalled = true;
        return {};
      },
      createItem: () => {
        bindingCalled = true;
        return {};
      },
      computeParameters: async () => {
        bindingCalled = true;
        return [];
      },
    },
  });

  const after = await prismaClient.deckFsrsConfig.findUniqueOrThrow({
    where: { id: config.id },
  });

  assert.equal(result.status, "failed");
  assert.equal(bindingCalled, false);
  assert.deepEqual(after.parametersJson, config.parametersJson);
  assert.equal(after.parametersSource, config.parametersSource);
  assert.equal(after.optimizerStatus, "failed");
  assert.match(after.optimizerError ?? "", /positive intervals/);
  assert.equal(after.lastOptimizedAt, null);
});

test("failed optimization preserves previous parameters and stores a safe error", async () => {
  const user = await createUser();
  const deck = await createDeck(user.id, `${runId}-failed-optimize`);
  const before = await prismaClient.deckFsrsConfig.findUniqueOrThrow({
    where: { deckId: deck.id },
  });

  const result = await optimizeDeckFsrs({
    userId: user.id,
    deckId: deck.id,
    force: true,
    now: new Date("2026-08-02T00:00:00.000Z"),
    binding: {
      createReview: (rating, deltaT) => ({ rating, deltaT }),
      createItem: (reviews) => ({ reviews }),
      computeParameters: async () => {
        throw new Error("simulated optimizer failure");
      },
    },
  });

  const after = await prismaClient.deckFsrsConfig.findUniqueOrThrow({
    where: { id: before.id },
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(after.parametersJson, before.parametersJson);
  assert.equal(after.parametersSource, before.parametersSource);
  assert.equal(after.optimizerStatus, "failed");
  assert.ok(after.optimizerError);
  assert.equal(after.lastOptimizedAt, null);
});
