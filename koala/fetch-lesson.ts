import { prismaClient } from "@/koala/prisma-client";
import { shuffle, unique } from "radash";
import { getUserSettings } from "./auth-helpers";
import { autoPromoteCards } from "./autopromote";
import { errorReport } from "./error-report";
import { maybeGetCardImageUrl } from "./image";
import { LessonType } from "./shared-types";
import { generateLessonAudio } from "./speech";
import { Card, Quiz } from "@prisma/client";

type GetLessonInputParams = {
  userId: string;
  deckId: number;
  now: number;
  take: number;
};
type CardKeys = "imageBlobId" | "definition" | "langCode" | "gender" | "term";
type LocalCard = Pick<Card, CardKeys>;
type QuizKeys =
  | "id"
  | "repetitions"
  | "lastReview"
  | "difficulty"
  | "stability"
  | "quizType"
  | "cardId"
  | "lapses";
type LocalQuiz = Pick<Quiz, QuizKeys> & { Card: LocalCard };

function interleave<T>(max: number, ...lists: T[][]): T[] {
  const result: T[] = [];
  let index = 0;
  while (result.length < max) {
    let inserted = false;
    for (const list of lists) {
      if (index < list.length) {
        result.push(list[index]);
        inserted = true;
        if (result.length === max) return result;
      }
    }
    if (!inserted) break;
    index++;
  }
  return result;
}

async function buildQuizPayload(quiz: LocalQuiz, playbackPercentage: number) {
  const r = quiz.repetitions || 0;
  return {
    quizId: quiz.id,
    cardId: quiz.cardId,
    definition: quiz.Card.definition,
    term: quiz.Card.term,
    repetitions: r,
    lapses: quiz.lapses,
    lessonType: quiz.quizType as LessonType,
    definitionAudio: await generateLessonAudio({
      card: quiz.Card,
      lessonType: "speaking",
      speed: 125,
    }),
    termAudio: await generateLessonAudio({
      card: quiz.Card,
      lessonType: "listening",
      speed: r > 1 ? playbackPercentage : 100,
    }),
    langCode: quiz.Card.langCode,
    lastReview: quiz.lastReview || 0,
    imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
    stability: quiz.stability,
    difficulty: quiz.difficulty,
  };
}

async function getAudioSpeed(userId: string) {
  const s = await getUserSettings(userId);
  return s.playbackSpeed || 1.0;
}

async function getCardsAllowedPerDay(userId: string) {
  const s = await getUserSettings(userId);
  return s.cardsPerDayMax || 24;
}

async function newCardsLearnedThisWeek(userId: string) {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;
  const t = Date.now() - ONE_WEEK;
  return prismaClient.card.count({
    where: {
      userId,
      Quiz: { some: { firstReview: { gte: t } } },
    },
  });
}

async function fetchDueCards(
  userId: string,
  deckId: number,
  now: number,
  quizType: string,
  older: boolean,
  limit: number,
) {
  if (limit < 1) return [];
  return prismaClient.quiz.findMany({
    where: {
      Card: { userId, deckId, flagged: { not: true } },
      quizType,
      nextReview: { lt: now },
      lastReview: { gt: 0 },
    },
    include: { Card: true },
    orderBy: { Card: { createdAt: older ? "asc" : "desc" } },
    take: limit,
  });
}

async function fetchNewCards(
  userId: string,
  deckId: number,
  older: boolean,
  limit: number,
) {
  if (limit < 1) return [];
  return prismaClient.quiz.findMany({
    where: {
      Card: { userId, deckId, flagged: { not: true } },
      lastReview: { equals: 0 },
    },
    include: { Card: true },
    orderBy: { Card: { createdAt: older ? "asc" : "desc" } },
    take: limit,
  });
}

async function getCardsWithFailures(
  userId: string,
  deckId: number,
  take: number,
): Promise<LocalQuiz[]> {
  const cards = await prismaClient.card.findMany({
    take,
    where: {
      deckId,
      userId: userId,
      lastFailure: { not: 0 },
      flagged: { not: true },
    },
    orderBy: { lastFailure: "asc" },
  });
  return cards.map((Card): LocalQuiz => {
    return {
      id: -1 * Math.round(Math.random() * 1000000),
      repetitions: 1,
      lapses: 1,
      lastReview: 999,
      difficulty: 999,
      stability: 999,
      quizType: "review",
      cardId: Card.id,
      Card,
    };
  });
}

async function newCardsAllowed(userId: string, take: number) {
  const weeklyCap = (await getCardsAllowedPerDay(userId)) * 7;
  const thisWeek = await newCardsLearnedThisWeek(userId);
  const deficiency = Math.max(weeklyCap - thisWeek, 0);
  const result = Math.min(take, deficiency);

  return result;
}

export async function getLessons(p: GetLessonInputParams) {
  const { userId, deckId, now, take } = p;
  await autoPromoteCards(userId);
  if (take > 45) return errorReport("Too many cards requested.");
  const speedPercent = Math.round((await getAudioSpeed(userId)) * 100);
  const newCardCount = await newCardsAllowed(userId, take);
  const listeningDueOld = await fetchDueCards(
    userId,
    deckId,
    now,
    "listening",
    true,
    take,
  );
  const listeningDueNew = await fetchDueCards(
    userId,
    deckId,
    now,
    "listening",
    false,
    take,
  );
  const speakingDueOld = await fetchDueCards(
    userId,
    deckId,
    now,
    "speaking",
    true,
    take,
  );
  const speakingDueNew = await fetchDueCards(
    userId,
    deckId,
    now,
    "speaking",
    false,
    take,
  );
  const importedEarly = await fetchNewCards(userId, deckId, true, take);
  const importedLate = await fetchNewCards(userId, deckId, false, take);
  const newCards = interleave(newCardCount, importedEarly, importedLate);
  const oldCards = interleave(
    take,
    listeningDueOld,
    listeningDueNew,
    speakingDueOld,
    speakingDueNew,
  );
  const failedCards = await getCardsWithFailures(userId, deckId, take);
  const allCards = unique(
    [...failedCards, ...newCards, ...oldCards],
    (q) => q.id,
  );
  const uniqueByCardId = unique(allCards, (q) => q.cardId);
  const cardIds = uniqueByCardId.map((q) => q.cardId);
  const repsByCard = await prismaClient.quiz.groupBy({
    by: ["cardId"],
    where: {
      cardId: { in: cardIds },
    },
    _sum: { repetitions: true },
  });

  const repsMap: Record<number, number> = Object.fromEntries(
    repsByCard.map((item) => [item.cardId, item._sum.repetitions || 0]),
  );

  return shuffle(uniqueByCardId)
    .slice(0, take)
    .map((quiz) => {
      const quizType = !repsMap[quiz.cardId] ? "dictation" : quiz.quizType;
      return buildQuizPayload({ ...quiz, quizType }, speedPercent);
    });
}
