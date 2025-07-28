import { prismaClient } from "@/koala/prisma-client";
import { shuffle } from "radash";
import { getUserSettings } from "./auth-helpers";
import { autoPromoteCards } from "./autopromote";
import { maybeGetCardImageUrl } from "./image";
import { generateLessonAudio } from "./speech";
import { LessonType } from "./shared-types";
import type { Card, Prisma, Quiz } from "@prisma/client";

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

type CardKeys =
  | "imageBlobId"
  | "definition"
  | "langCode"
  | "gender"
  | "term";

type QuizKeys =
  | "id"
  | "repetitions"
  | "lastReview"
  | "difficulty"
  | "stability"
  | "quizType"
  | "cardId"
  | "lapses"
  | "firstReview"
  | "nextReview";

type LocalQuiz = Pick<Quiz, QuizKeys> & {
  Card: Pick<Card, CardKeys | "lastFailure" | "flagged">;
};

const NEW_CARD = "N" as const;
const ORDINARY = "O" as const;
const REMEDIAL = "R" as const;
const UPCOMING = "U" as const;
const ONE_DAY_MS = 86_400_000;
const MIN_REVIEWS_TO_STUDY_AHEAD = 2;
const NEW_CARD_DEFAULT_TARGET = 7;
const UPCOMING_WINDOW_MS = ONE_DAY_MS * 7;
const REVIEWS_PER_DAY_MULTIPLIER = 6;
const DECK_HAND_HARD_CAP = 45;
const ROUND_ROBIN_ORDER: Bucket[] = [NEW_CARD, ORDINARY, REMEDIAL];
const ENGLISH_SPEED = 125;

async function getDailyLimits(userId: string, now: number) {
  const { cardsPerDayMax = NEW_CARD_DEFAULT_TARGET } =
    await getUserSettings(userId);
  const reviewsPerDayMax = cardsPerDayMax * REVIEWS_PER_DAY_MULTIPLIER;
  const since = now - ONE_DAY_MS;

  const newLearned = (
    await prismaClient.quiz.groupBy({
      by: ["cardId"],
      where: { Card: { userId }, firstReview: { gte: since } },
    })
  ).length;

  const reviewsDone = await prismaClient.quiz.count({
    where: { Card: { userId }, lastReview: { gte: since } },
  });

  return {
    newRemaining: Math.max(cardsPerDayMax - newLearned, 0),
    reviewRemaining: Math.max(reviewsPerDayMax - reviewsDone, 0),
  };
}

/** Pull a shuffled, deduped queue for a given bucket. */
async function fetchBucket(
  bucket: Bucket,
  userId: string,
  deckId: number,
  now: number,
): Promise<LocalQuiz[]> {
  const base = {
    Card: { userId, deckId, flagged: { not: true } },
  };

  let where: Prisma.QuizWhereInput = {};
  switch (bucket) {
    case NEW_CARD:
      where = { ...base, lastReview: 0 };
      break;
    case ORDINARY:
      where = { ...base, lastReview: { gt: 0 }, nextReview: { lte: now } };
      break;
    case REMEDIAL:
      return (
        await prismaClient.card.findMany({
          where: {
            userId,
            deckId,
            flagged: { not: true },
            lastFailure: { gt: 0 },
          },
          include: { Quiz: true },
        })
      )
        .map(
          (Card): LocalQuiz => ({
            ...Card.Quiz[0],
            Card,
            quizType: "remedial",
          }),
        )
        .sort(() => Math.random() - 0.5);
    case UPCOMING:
      where = {
        ...base,
        repetitions: { gte: MIN_REVIEWS_TO_STUDY_AHEAD },
        nextReview: { gt: now, lte: now + UPCOMING_WINDOW_MS },
      };
      break;
  }

  return shuffle(
    await prismaClient.quiz.findMany({
      where,
      include: { Card: true },
      take: DECK_HAND_HARD_CAP,
    }),
  );
}

/** Decide lessonType override for special buckets. */
function tagLessonType(q: LocalQuiz, bucket: Bucket): LocalQuiz {
  if (bucket === NEW_CARD) {
    return { ...q, quizType: "new" };
  }
  if (bucket === REMEDIAL) {
    return { ...q, quizType: "remedial" };
  }
  /* O or U keep existing listening/speaking type */
  return q;
}

/** Build user‑visible payload, including TTS URLs. */
async function buildQuizPayload(q: LocalQuiz, speedPct: number) {
  const r = q.repetitions ?? 0;
  return {
    quizId: q.id,
    cardId: q.cardId,
    definition: q.Card.definition,
    term: q.Card.term,
    repetitions: r,
    lapses: q.lapses,
    lessonType: q.quizType as LessonType,
    definitionAudio: await generateLessonAudio({
      card: q.Card,
      lessonType: "speaking",
      speed: ENGLISH_SPEED,
    }),
    termAudio: await generateLessonAudio({
      card: q.Card,
      lessonType: "listening",
      speed: r > 1 ? speedPct : 100,
    }),
    langCode: q.Card.langCode,
    lastReview: q.lastReview ?? 0,
    imageURL: await maybeGetCardImageUrl(q.Card.imageBlobId),
    stability: q.stability,
    difficulty: q.difficulty,
  };
}

/* ─────────────────── CORE HAND BUILDER ─────────────────── */

/** Core selector ‑ returns LocalQuiz[] (no audio). */
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

  const queues: Record<Bucket, LocalQuiz[]> = {
    N: (await fetchBucket(NEW_CARD, userId, deckId, now)).map((q) =>
      tagLessonType(q, NEW_CARD),
    ),
    O: (await fetchBucket(ORDINARY, userId, deckId, now)).map((q) =>
      tagLessonType(q, ORDINARY),
    ),
    R: await fetchBucket(REMEDIAL, userId, deckId, now),
    U: (await fetchBucket(UPCOMING, userId, deckId, now)).map((q) =>
      tagLessonType(q, UPCOMING),
    ),
  };

  const hand: LocalQuiz[] = [];
  const seenCards = new Set<number>();
  const bucketIndexes: Record<Bucket, number> = { N: 0, O: 0, R: 0, U: 0 };
  let newLeft = newRemaining;
  let reviewLeft = reviewRemaining;

  while (hand.length < take && reviewLeft > 0) {
    let progressed = false;
    const buckets = shuffle(ROUND_ROBIN_ORDER);
    for (const b of buckets) {
      const idx = bucketIndexes[b];
      const q = queues[b][idx];
      if (!q) {
        continue;
      }

      bucketIndexes[b] += 1;
      progressed = true;
      if (seenCards.has(q.cardId)) {
        continue;
      }
      if (b === NEW_CARD && newLeft === 0) {
        continue;
      }
      if (reviewLeft === 0) {
        break;
      }

      hand.push(q);
      seenCards.add(q.cardId);
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

  if (hand.length < take && reviewLeft > 0) {
    for (const q of queues.U) {
      if (hand.length === take) {
        break;
      }
      if (reviewLeft === 0) {
        break;
      }
      if (seenCards.has(q.cardId)) {
        continue;
      }
      hand.push(q);
      seenCards.add(q.cardId);
      reviewLeft -= 1;
    }
  }

  // Get count of all quizzes due where userId = ? and archived != true:
  const count = await prismaClient.quiz.count({
    where: {
      Card: { userId, deckId, flagged: { not: true } },
      nextReview: { lte: now },
      lastReview: { gt: 0 },
    },
  });

  console.log(
    `=== TOTAL QUIZZES DUE: Raw: ${count} / Filtered: ${hand.length} ===`,
  );

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

  await autoPromoteCards(userId);

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
