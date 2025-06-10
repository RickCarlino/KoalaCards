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
type CardKeys =
  | "imageBlobId"
  | "definition"
  | "langCode"
  | "gender"
  | "term";
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

async function buildQuizPayload(
  quiz: LocalQuiz,
  playbackPercentage: number,
) {
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

async function fetchDueCards(userId: string, deckId: number, now: number) {
  return prismaClient.quiz.findMany({
    where: {
      Card: { userId, deckId, flagged: { not: true } },
      nextReview: { lt: now },
      lastReview: { gt: 0 },
    },
    include: { Card: true },
    orderBy: [
      // "speaking" before "listening"
      { quizType: "asc" },
      { nextReview: "asc" },
    ],
  });
}

async function fetchNewCards(userId: string, deckId: number) {
  const limit = await newCardsAllowed(userId);
  console.log(`New cards allowed: ${limit}`);
  if (limit < 1) return [];
  const ids = shuffle(
    await prismaClient.quiz.findMany({
      where: {
        Card: { userId, deckId, flagged: { not: true } },
        lastReview: { equals: 0 },
      },
      select: { id: true },
    }),
  )
    .slice(0, limit)
    .map((q) => q.id);
  return prismaClient.quiz.findMany({
    where: {
      id: { in: ids },
    },
    include: { Card: true },
  });
}

async function fetchRemedial(
  userId: string,
  deckId: number,
): Promise<LocalQuiz[]> {
  const cards = await prismaClient.card.findMany({
    where: {
      deckId,
      userId: userId,
      lastFailure: { not: 0 },
      flagged: { not: true },
    },
    orderBy: { lastFailure: "asc" },
    include: { Quiz: true },
  });
  return cards.map((Card): LocalQuiz => {
    const lastQuiz = Card.Quiz[0]!;
    return {
      ...lastQuiz,
      quizType: "remedial",
      Card,
    };
  });
}

const FAUCET_CAPACITY = 60; // 60 cards due in next 24 hours
const maybeSlowLearningRate = async (userId: string): Promise<boolean> => {
  // Return 0 if > 100 cards due in next 24 hours:
  const dueCards = await prismaClient.quiz.count({
    where: {
      Card: {
        userId,
        flagged: { not: true },
      },
      nextReview: { lt: Date.now() + 24 * 60 * 60 * 1000 },
      lastReview: { gt: 0 },
    },
  });
  if (dueCards > FAUCET_CAPACITY) {
    console.log(
      `User ${userId} has ${dueCards} due cards. Slowing down learning rate.`,
    );
    return true;
  }
  return false;
};

async function newCardsAllowed(userId: string) {
  const yes = await maybeSlowLearningRate(userId);
  if (yes) return 0;

  const dailyTarget = await getCardsAllowedPerDay(userId);
  const maxWeekly = dailyTarget * 7;
  const dailyMax = Math.min(dailyTarget * 2, 45);
  const thisWeek = (
    await prismaClient.quiz.findMany({
      select: { id: true },
      where: {
        Card: { userId },
        firstReview: {
          gte: Date.now() - 7 * 24 * 60 * 60 * 1000,
        },
      },
      distinct: ["cardId"],
    })
  ).length;
  const result =
    thisWeek >= maxWeekly ? 0 : Math.min(maxWeekly - thisWeek, dailyMax);

  return result;
}

export async function getLessons(p: GetLessonInputParams) {
  const { userId, deckId, now, take } = p;
  await autoPromoteCards(userId);
  if (take > 45) return errorReport("Too many cards requested.");
  const speedPercent = Math.round((await getAudioSpeed(userId)) * 100);
  const unsorted = [
    ...(await fetchNewCards(userId, deckId)),
    ...(await fetchRemedial(userId, deckId)),
    ...(await fetchDueCards(userId, deckId, now)),
  ];
  const allCards = unique(unsorted, (q) => q.cardId);
  const repsByCard = await prismaClient.quiz.groupBy({
    by: ["cardId"],
    where: {
      cardId: { in: allCards.map((q) => q.cardId) },
    },
    _sum: { repetitions: true },
  });

  const repsMap: Record<number, number> = Object.fromEntries(
    repsByCard.map((item) => [item.cardId, item._sum.repetitions || 0]),
  );

  return shuffle(allCards)
    .slice(0, take)
    .map((quiz) => {
      const quizType = "listening"; // !repsMap[quiz.cardId] ? "new" : quiz.quizType;
      return buildQuizPayload({ ...quiz, quizType }, speedPercent);
    });
}
