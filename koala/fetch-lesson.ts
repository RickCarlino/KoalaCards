import { prismaClient } from "@/koala/prisma-client";
import type { Card, Prisma } from "@prisma/client";
import { shuffle } from "radash";
import { getUserSettings } from "./auth-helpers";
import { maybeGetCardImageUrl } from "./image";
import { LessonType } from "./shared-types";
import { generateLessonAudio } from "./speech";

type Bucket =
  | typeof NEW_CARD
  | typeof ORDINARY
  | typeof REMEDIAL
  | typeof UPCOMING;

type GetLessonInputParams = {
  userId: string;
  deckId: number;
  now: number;
  take: number;
};

type LocalCard = Pick<
  Card,
  | "id"
  | "repetitions"
  | "lastReview"
  | "difficulty"
  | "stability"
  | "lapses"
  | "firstReview"
  | "nextReview"
  | "term"
  | "definition"
  | "langCode"
  | "imageBlobId"
  | "lastFailure"
  | "flagged"
>;

const NEW_CARD = "N" as const;
const ORDINARY = "O" as const;
const REMEDIAL = "R" as const;
const UPCOMING = "U" as const;
const ONE_DAY_MS = 86_400_000;
const MIN_REVIEWS_TO_STUDY_AHEAD = 2;
const NEW_CARD_DEFAULT_TARGET = 7;
const UPCOMING_WINDOW_MS = ONE_DAY_MS * 7;
const REVIEWS_PER_DAY_MULTIPLIER = 7;
const DECK_HAND_HARD_CAP = 50;
const ROUND_ROBIN_ORDER: Bucket[] = [REMEDIAL, NEW_CARD, ORDINARY];
const ENGLISH_SPEED = 125;
const MIN_HAND_SIZE = 3; // Say 0 cards are due if we can't build a hand of at least this size.

/* helper ─ identity; previously de-duped per cardId (no longer needed) */
function pickOnePerCard<T>(rows: T[]): T[] {
  return rows;
}

/**
 * Rolling‑24h quotas.
 * – newRemaining     → how many brand‑new cards the user may still learn
 * – reviewRemaining  → how many total quizzes remain before hitting today’s cap
 */
async function getDailyLimits(userId: string, now: number) {
  const { cardsPerDayMax = NEW_CARD_DEFAULT_TARGET } =
    await getUserSettings(userId);

  const reviewsPerDayMax = cardsPerDayMax * REVIEWS_PER_DAY_MULTIPLIER;
  const since = now - ONE_DAY_MS;

  /* 1️⃣  “New cards learned in the last 24h” = cards whose **earliest**
         firstReview timestamp is within that window. */
  const newLearned = await prismaClient.card.count({
    where: {
      userId,
      flagged: { not: true },
      firstReview: { gte: since },
    },
  });

  /* 2️⃣  Total quizzes reviewed (any modality) in the last 24h */
  const reviewsDone = await prismaClient.card.count({
    where: { userId, flagged: { not: true }, lastReview: { gte: since } },
  });

  return {
    newRemaining: Math.max(cardsPerDayMax - newLearned, 0),
    reviewRemaining: Math.max(reviewsPerDayMax - reviewsDone, 0),
  };
}

/** Pull a shuffled, de‑duped queue for a given bucket. */
async function fetchBucket(
  bucket: Bucket,
  userId: string,
  deckId: number,
  now: number,
): Promise<LocalCard[]> {
  /* ───────────── remedial bucket has its own query ───────────── */
  if (bucket === REMEDIAL) {
    const cards = await prismaClient.card.findMany({
      where: {
        deckId,
        userId,
        lastFailure: { gt: 0 },
        flagged: { not: true },
      },
      orderBy: { lastFailure: "asc" },
      take: DECK_HAND_HARD_CAP * 2,
    });

    return pickOnePerCard(cards);
  }

  /* base filter reused by all other buckets */
  const baseCard: Prisma.CardWhereInput = {
    userId,
    deckId,
    flagged: { not: true },
  };

  let where: Prisma.CardWhereInput;

  switch (bucket) {
    /* ───────────── NEW (brand‑new cards only) ───────────── */
    case NEW_CARD:
      where = { ...baseCard, lastReview: 0 };
      break;

    /* ───────────── ORDINARY (due now + orphan rows) ───────────── */
    case ORDINARY:
      where = {
        ...baseCard,
        lastFailure: 0,
        lastReview: { gt: 0 },
        nextReview: { lte: now },
      };
      break;

    /* ───────────── UPCOMING (≤7days, repetitions≥2) ───────────── */
    case UPCOMING:
      where = {
        ...baseCard,
        lastFailure: 0,
        repetitions: { gte: MIN_REVIEWS_TO_STUDY_AHEAD },
        nextReview: { gt: now, lte: now + UPCOMING_WINDOW_MS },
      };
      break;
  }

  /* fetch, dedupe, shuffle */
  const rows = await prismaClient.card.findMany({
    where,
    take: DECK_HAND_HARD_CAP,
  });

  return shuffle(pickOnePerCard(rows));
}

/** Decide lessonType override for special buckets. */
function tagLessonType(
  q: LocalCard,
  bucket: Bucket,
): LocalCard & { quizType?: string } {
  if (bucket === NEW_CARD) {
    return { ...q, quizType: "new" };
  }
  if (bucket === REMEDIAL) {
    return { ...q, quizType: "remedial" };
  }
  return q;
}

/** Build user‑visible payload, including TTS URLs. */
async function buildQuizPayload(
  q: LocalCard & { quizType?: string },
  speedPct: number,
) {
  const r = q.repetitions ?? 0;
  return {
    cardId: q.id,
    definition: q.definition,
    term: q.term,
    repetitions: r,
    lapses: q.lapses,
    lessonType: (q.quizType as LessonType) ?? ("speaking" as LessonType),
    definitionAudio: await generateLessonAudio({
      card: q as Card,
      lessonType: "speaking",
      speed: ENGLISH_SPEED,
    }),
    termAndDefinitionAudio: await generateLessonAudio({
      card: q as Card,
      lessonType: "new",
      speed: r > 1 ? speedPct : 100,
    }),
    langCode: q.langCode,
    lastReview: q.lastReview ?? 0,
    imageURL: await maybeGetCardImageUrl(q.imageBlobId),
    stability: q.stability,
    difficulty: q.difficulty,
  };
}

/* ─────────────────── CORE HAND BUILDER ─────────────────── */

/** Core selector ‑ returns LocalCard[] (no audio). */
async function buildHand(
  userId: string,
  deckId: number,
  now: number,
  take: number,
) {
  const { newRemaining, reviewRemaining } = await getDailyLimits(
    userId,
    now,
  );
  if (reviewRemaining === 0) {
    return [];
  }

  const tag = (tag: Bucket) => (q: LocalCard) => tagLessonType(q, tag);
  const fetch = (tag: Bucket) => fetchBucket(tag, userId, deckId, now);
  const shuffleQuizzes = (quiz: LocalCard[]) => shuffle(quiz);
  const queues: Record<Bucket, LocalCard[]> = {
    N: shuffleQuizzes((await fetch(NEW_CARD)).map(tag(NEW_CARD))),
    O: shuffleQuizzes((await fetch(ORDINARY)).map(tag(ORDINARY))),
    R: shuffleQuizzes(await fetch(REMEDIAL)),
    U: shuffleQuizzes((await fetch(UPCOMING)).map(tag(UPCOMING))),
  };

  const hand: LocalCard[] = [];
  const seenCards = new Set<number>();
  const bucketIndexes: Record<Bucket, number> = { N: 0, O: 0, R: 0, U: 0 };
  let newLeft = newRemaining;
  let reviewLeft = reviewRemaining;

  while (hand.length < take && reviewLeft > 0) {
    let progressed = false;
    for (const b of ROUND_ROBIN_ORDER) {
      const idx = bucketIndexes[b];
      const q = queues[b][idx];
      if (!q) {
        continue;
      }

      bucketIndexes[b] += 1;
      progressed = true;
      if (seenCards.has(q.id)) {
        continue;
      }
      if (b === NEW_CARD && newLeft === 0) {
        continue;
      }
      if (reviewLeft === 0) {
        break;
      }

      hand.push(q);
      seenCards.add(q.id);
      reviewLeft -= 1;
      if (b === NEW_CARD) {
        newLeft -= 1;
      }
      if (hand.length === take) {
        break;
      }
    }
    if (!progressed) {
      break;
    }
  }

  if (hand.length < Math.min(MIN_HAND_SIZE, take)) {
    return [];
  }

  if (hand.length < take && reviewLeft > 0) {
    for (const q of queues.U) {
      if (hand.length === take) {
        break;
      }
      if (reviewLeft === 0) {
        break;
      }
      if (seenCards.has(q.id)) {
        continue;
      }
      hand.push(q);
      seenCards.add(q.id);
      reviewLeft -= 1;
    }
  }

  return hand;
}

export async function getLessons({
  userId,
  deckId,
  now,
  take,
}: GetLessonInputParams) {
  if (take > DECK_HAND_HARD_CAP) {
    throw new Error("Too many cards requested.");
  }

  // No-op: previously removed non-speaking quizzes.

  const rawHand = await buildHand(userId, deckId, now, take);
  const speedPct = Math.round(
    (await getUserSettings(userId)).playbackSpeed * 100,
  );

  return Promise.all(rawHand.map((q) => buildQuizPayload(q, speedPct)));
}

/**
 * Fast helper: “How many cards are currently due?”
 * Uses the same heuristics but skips expensive TTS generation.
 */
export async function getLessonsDue(
  deckId: number,
  now: number = Date.now(),
) {
  const deck = await prismaClient.deck.findUnique({
    where: { id: deckId },
    select: { userId: true },
  });
  const userId =
    deck?.userId ??
    (
      await prismaClient.card.findFirst({
        where: { deckId },
        select: { userId: true },
      })
    )?.userId;
  if (!userId) {
    return 0;
  }

  const hand = await buildHand(userId, deckId, now, DECK_HAND_HARD_CAP);
  return hand.length;
}
