import { prismaClient } from "@/koala/prisma-client";
import type { Card, Prisma } from "@prisma/client";
import { generateAIText } from "./ai";
import { getUserSettings } from "./auth-helpers";
import { maybeGetCardImageUrl } from "./image";
import { LessonType } from "./shared-types";
import { generateDefinitionAudio, generateTermAudio } from "./speech";
import { containsEmoji } from "./utils/emoji";

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
  | "flagged"
  | "gender"
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

async function getDailyLimits(userId: string, now: number) {
  const { cardsPerDayMax = NEW_CARD_DEFAULT_TARGET } =
    await getUserSettings(userId);

  const newLearned = await prismaClient.card.count({
    where: {
      userId,
      flagged: { not: true },
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
    flagged: { not: true },
  };

  let where: Prisma.CardWhereInput;
  let orderBy: Prisma.CardOrderByWithRelationInput | undefined;

  switch (bucket) {
    case NEW_CARD:
      where = { ...baseCard, lastReview: 0 };
      orderBy = { createdAt: "asc" };
      break;

    case ROUTINE:
      where = {
        ...baseCard,
        lastFailure: 0,
        lastReview: { gt: 0 },
        nextReview: { lte: now },
      };
      orderBy = { nextReview: "asc" };
      break;

    case REMEDIAL:
      where = { ...baseCard, lastFailure: { gt: 0 } };
      orderBy = { lastFailure: "asc" };
      break;
  }

  return prismaClient.card.findMany({ where, orderBy, take: limit });
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

async function buildQuizPayload(q: LocalCard & { quizType?: string }) {
  const r = q.repetitions ?? 0;
  const definitionAudio = await generateDefinitionAudio(q.definition);
  const termAudio = await generateTermAudio({
    card: q as Card,
  });
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
    imageURL: await maybeGetCardImageUrl(q.imageBlobId),
    stability: q.stability,
    difficulty: q.difficulty,
  };
}

type EmojiUpdate = {
  id: number;
  definition: string;
};

function needsEmojiDefinition(definition: string) {
  return !containsEmoji(definition);
}

function appendEmojis(definition: string, emojis: string) {
  const base = definition.trim();
  return `${base} ${emojis}`;
}

function takeFirstTwoEmojis(input: string) {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  const matches = input.match(emojiRegex);
  if (!matches) {
    return null;
  }
  return matches.slice(0, 2).join(" ");
}

async function requestEmojiDefinition(term: string, definition: string) {
  const response = await generateAIText({
    model: "fast",
    messages: [
      {
        role: "system",
        content:
          "Only reply with emoji. Pick the two emojis that best represent the flashcard.",
      },
      {
        role: "user",
        content: `${term}: ${definition}`,
      },
    ],
    maxTokens: 50,
  });

  const raw = response.trim();
  if (!containsEmoji(raw)) {
    return null;
  }
  return takeFirstTwoEmojis(raw);
}

async function addEmojisToDefinitions(
  hand: LocalCard[],
): Promise<LocalCard[]> {
  const pending = hand.filter((card) =>
    needsEmojiDefinition(card.definition),
  );
  if (!pending.length) {
    return hand;
  }

  const emojiUpdates = await Promise.all(
    pending.map(async (card): Promise<EmojiUpdate | null> => {
      const emojis = await requestEmojiDefinition(
        card.term,
        card.definition,
      );
      if (!emojis) {
        return null;
      }
      return {
        id: card.id,
        definition: appendEmojis(card.definition, emojis),
      };
    }),
  );

  const updates = emojiUpdates.filter(
    (update): update is EmojiUpdate => update !== null,
  );
  if (!updates.length) {
    return hand;
  }

  await prismaClient.$transaction(
    updates.map((update) =>
      prismaClient.card.updateMany({
        where: { id: update.id },
        data: { definition: update.definition },
      }),
    ),
  );

  const updatesById = new Map(
    updates.map((update) => [update.id, update.definition]),
  );

  return hand.map((card) => {
    const definition = updatesById.get(card.id);
    if (!definition) {
      return card;
    }
    return { ...card, definition };
  });
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

  const rawHand = await buildHand(userId, deckId, now, take);
  const hand = await addEmojisToDefinitions(rawHand);

  return Promise.all(hand.slice(0, 5).map((q) => buildQuizPayload(q)));
}

export async function getLessonsDue(
  deckId: number,
  now: number = Date.now(),
) {
  return prismaClient.card.count({
    where: {
      deckId,
      flagged: { not: true },
      lastReview: { gt: 0 },
      nextReview: { lte: now },
      lastFailure: 0,
    },
  });
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
      flagged: { not: true },
      lastReview: 0,
    },
  });
  return newCardsInDeck > 0;
}
