import { prismaClient } from "@/koala/prisma-client";
import type { Card, Prisma } from "@prisma/client";
import { shuffle } from "radash";
import { getUserSettings } from "./auth-helpers";
import {
  resolveDeckScheduler,
  serializeDeckScheduler,
  type ResolvedDeckScheduler,
} from "./fsrs/scheduler";
import { maybeGetCardImageUrl } from "./image";
import { LessonType } from "./shared-types";
import { generateDefinitionAudio, generateTermAudio } from "./speech";

type Bucket = typeof NEW_CARD | typeof ROUTINE | typeof REMEDIAL;

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
  | "imageBlobId"
  | "lastFailure"
  | "paused"
>;

const NEW_CARD = "N" as const;
const ROUTINE = "O" as const;
const REMEDIAL = "R" as const;
const ONE_DAY_MS = 86_400_000;
const TWO_DAYS_MS = ONE_DAY_MS * 2;
const NEW_CARD_DEFAULT_TARGET = 7;
const DECK_HAND_HARD_CAP = 50;
const ROUND_ROBIN_ORDER: Bucket[] = [REMEDIAL, NEW_CARD, ROUTINE];
const PER_BUCKET_PREFETCH = 45;
const NEW_CARD_WINDOW_SIZE = 1000;
const QUIZ_PAYLOAD_CONCURRENCY = 4;

async function getDailyLimits(userId: string, now: number) {
  const { cardsPerDayMax = NEW_CARD_DEFAULT_TARGET } =
    await getUserSettings(userId);

  const newLearned = await prismaClient.card.count({
    where: {
      userId,
      paused: { not: true },
      firstReview: { gte: now - TWO_DAYS_MS },
    },
  });

  const windowAllowance = cardsPerDayMax * 2;
  return { newRemaining: Math.max(windowAllowance - newLearned, 0) };
}

async function fetchBucket(
  bucket: Bucket,
  userId: string,
  deckId: number,
  now: number,
  limit: number,
): Promise<LocalCard[]> {
  const baseCard: Prisma.CardWhereInput = {
    userId,
    deckId,
    paused: { not: true },
  };

  if (bucket === NEW_CARD) {
    return fetchRandomNewCards(baseCard, limit);
  }

  let where: Prisma.CardWhereInput;
  let orderBy: Prisma.CardOrderByWithRelationInput | undefined;

  if (bucket === ROUTINE) {
    where = {
      ...baseCard,
      lastFailure: 0,
      lastReview: { gt: 0 },
      nextReview: { lte: now },
    };
    orderBy = { nextReview: "asc" };
  } else {
    where = { ...baseCard, lastFailure: { gt: 0 } };
    orderBy = { lastFailure: "asc" };
  }

  return prismaClient.card.findMany({ where, orderBy, take: limit });
}

async function fetchRandomNewCards(
  baseCard: Prisma.CardWhereInput,
  limit: number,
): Promise<LocalCard[]> {
  if (limit <= 0) {
    return [];
  }

  const where: Prisma.CardWhereInput = {
    ...baseCard,
    lastReview: 0,
  };

  const total = await prismaClient.card.count({ where });
  if (total === 0) {
    return [];
  }

  const windowSize = Math.min(NEW_CARD_WINDOW_SIZE, total);
  const maxOffset = Math.max(total - windowSize, 0);
  const offset =
    maxOffset > 0 ? Math.floor(Math.random() * (maxOffset + 1)) : 0;

  const idRows = await prismaClient.card.findMany({
    where,
    select: { id: true },
    orderBy: { createdAt: "asc" },
    skip: offset,
    take: windowSize,
  });

  if (!idRows.length) {
    return [];
  }

  const pickedIds = shuffle(idRows.map((row) => row.id)).slice(0, limit);
  if (!pickedIds.length) {
    return [];
  }

  const cards = await prismaClient.card.findMany({
    where: { id: { in: pickedIds } },
  });

  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const orderedCards: LocalCard[] = [];
  for (const id of pickedIds) {
    const card = cardsById.get(id);
    if (card) {
      orderedCards.push(card);
    }
  }
  return orderedCards;
}

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

async function buildQuizPayload(
  q: LocalCard & { quizType?: string },
  scheduler: ResolvedDeckScheduler,
) {
  const r = q.repetitions ?? 0;
  const [definitionAudio, termAudio, imageURL] = await Promise.all([
    buildQuizAsset(q.id, "definition audio", "", () =>
      generateDefinitionAudio(q.definition),
    ),
    buildQuizAsset(q.id, "term audio", "", () =>
      generateTermAudio({
        card: q as Card,
      }),
    ),
    buildQuizAsset(q.id, "card image", undefined, () =>
      maybeGetCardImageUrl(q.imageBlobId),
    ),
  ]);
  return {
    cardId: q.id,
    definition: q.definition,
    term: q.term,
    repetitions: r,
    lapses: q.lapses,
    lessonType: (q.quizType as LessonType) ?? ("speaking" as LessonType),
    definitionAudio,
    termAudio,
    langCode: "ko",
    lastReview: q.lastReview ?? 0,
    nextReview: q.nextReview ?? 0,
    imageURL,
    stability: q.stability,
    difficulty: q.difficulty,
    scheduler: serializeDeckScheduler(scheduler),
  };
}

async function buildQuizAsset<T>(
  cardId: number,
  label: string,
  fallback: T,
  load: () => Promise<T>,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(
      `Unable to prepare ${label} for review card ${cardId}:`,
      error,
    );
    return fallback;
  }
}

async function buildHand(
  userId: string,
  deckId: number,
  now: number,
  take: number,
) {
  const { newRemaining } = await getDailyLimits(userId, now);

  const limit = Math.min(PER_BUCKET_PREFETCH, take);
  const queues: Record<Bucket, LocalCard[]> = {
    N: (await fetchBucket(NEW_CARD, userId, deckId, now, limit)).map((q) =>
      tagLessonType(q, NEW_CARD),
    ),
    O: (await fetchBucket(ROUTINE, userId, deckId, now, limit)).map((q) =>
      tagLessonType(q, ROUTINE),
    ),
    R: (await fetchBucket(REMEDIAL, userId, deckId, now, limit)).map((q) =>
      tagLessonType(q, REMEDIAL),
    ),
  };

  const hand: LocalCard[] = [];
  const seen = new Set<number>();
  const idx: Record<Bucket, number> = { N: 0, O: 0, R: 0 };
  let newLeft = newRemaining;

  while (hand.length < take) {
    let progressed = false;
    for (const b of ROUND_ROBIN_ORDER) {
      const i = idx[b];
      const q = queues[b][i];
      if (!q) {
        continue;
      }
      idx[b] = i + 1;
      progressed = true;

      if (seen.has(q.id)) {
        continue;
      }
      if (b === NEW_CARD && newLeft === 0) {
        continue;
      }

      hand.push(q);
      seen.add(q.id);
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

  return hand;
}

export async function getLessons({
  userId,
  deckId,
  now,
  take,
}: GetLessonInputParams) {
  if (take > DECK_HAND_HARD_CAP) {
    take = DECK_HAND_HARD_CAP;
  }

  const hand = await buildHand(userId, deckId, now, take);
  const scheduler = await resolveDeckScheduler({ userId, deckId });
  const quizzes: Awaited<ReturnType<typeof buildQuizPayload>>[] = [];

  for (let i = 0; i < hand.length; i += QUIZ_PAYLOAD_CONCURRENCY) {
    const batch = hand.slice(i, i + QUIZ_PAYLOAD_CONCURRENCY);
    quizzes.push(
      ...(await Promise.all(
        batch.map((q) => buildQuizPayload(q, scheduler)),
      )),
    );
  }

  return quizzes;
}

export async function getLessonsDue(
  deckId: number,
  now: number = Date.now(),
) {
  const routineDue = await prismaClient.card.count({
    where: {
      deckId,
      paused: { not: true },
      lastReview: { gt: 0 },
      nextReview: { lte: now },
      lastFailure: 0,
    },
  });
  const remedialDue = await prismaClient.card.count({
    where: {
      deckId,
      paused: { not: true },
      lastFailure: { gt: 0 },
    },
  });
  return routineDue + remedialDue;
}

export async function canStartNewLessons(
  userId: string,
  deckId: number,
  now: number = Date.now(),
): Promise<boolean> {
  const { newRemaining } = await getDailyLimits(userId, now);
  if (newRemaining <= 0) {
    return false;
  }

  const newCardsInDeck = await prismaClient.card.count({
    where: {
      userId,
      deckId,
      paused: { not: true },
      lastReview: 0,
    },
  });
  return newCardsInDeck > 0;
}
