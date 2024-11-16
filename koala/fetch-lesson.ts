import { prismaClient } from "@/koala/prisma-client";
import { map, zip } from "radash";
import { Quiz, Card } from "@prisma/client";
import { getUserSettings } from "./auth-helpers";
import { errorReport } from "./error-report";
import { maybeGetCardImageUrl } from "./image";
import { LessonType } from "./shared-types";
import { generateLessonAudio } from "./speech";

type GetLessonInputParams = {
  userId: string;
  /** Current time */
  now: number;
  /** Max number of cards to return */
  take: number;
};

async function getCards(
  userId: string,
  now: number,
  take: number,
  isReview: boolean,
) {
  if (take < 1) return [];

  const base = {
    Card: { userId, flagged: { not: true } },
  };

  const whereClause = isReview
    ? { ...base, nextReview: { lt: now }, repetitions: { gt: 0 } }
    : { ...base, repetitions: 0 };

  return await prismaClient.quiz.findMany({
    where: whereClause,
    distinct: ["cardId"],
    orderBy: isReview
      ? [{ quizType: "asc" }, { nextReview: "asc" }]
      : [{ Card: { createdAt: "desc" } }], // TODO: Change to desc later.
    include: { Card: true },
    take,
  });
}

function cardCountNewToday(userID: string): Promise<number> {
  const _24HoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  return prismaClient.card.count({
    where: {
      userId: userID,
      Quiz: {
        every: {
          firstReview: {
            gte: _24HoursAgo,
          },
        },
      },
    },
  });
}

// A prisma quiz with Card included
type LocalQuiz = Quiz & { Card: Card };

async function prepareQuizData(quiz: LocalQuiz, playbackPercentage: number) {
  const repetitions = quiz.repetitions || 0;
  return {
    quizId: quiz.id,
    cardId: quiz.cardId,
    definition: quiz.Card.definition,
    term: quiz.Card.term,
    repetitions,
    lapses: quiz.lapses,
    lessonType: quiz.quizType as LessonType,
    definitionAudio: await generateLessonAudio({
      card: quiz.Card,
      lessonType: "speaking",
      speed: 115,
    }),
    termAudio: await generateLessonAudio({
      card: quiz.Card,
      lessonType: "listening",
      // Always play new cards at 95% speed
      speed: repetitions > 2 ? playbackPercentage : 95,
    }),
    langCode: quiz.Card.langCode,
    lastReview: quiz.lastReview || 0,
    imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
  };
}

const playbackSpeed = async (userID: string) => {
  return await getUserSettings(userID).then((s) => s.playbackSpeed || 1.05);
};

const newCardsPerDay = async (userID: string) => {
  return await getUserSettings(userID).then((s) => s.cardsPerDayMax || 10);
};

const getNewCards = async (userId: string, now: number, take: number) => {
  const maxNew = await newCardsPerDay(userId);
  const newToday = await cardCountNewToday(userId);
  const allowedNew = Math.max(maxNew - newToday, 0);
  const maxNewCards = Math.min(take, allowedNew);

  return await getCards(userId, now, maxNewCards, false);
};

export async function getLessons(p: GetLessonInputParams) {
  const { userId, now, take } = p;

  if (take > 15) return errorReport("Too many cards requested.");

  const newCards = await getNewCards(userId, now, take);
  const oldCards = await getCards(userId, now, take, true);

  const combined = zip(oldCards, newCards)
    .flat()
    .filter(Boolean)
    .slice(0, take);
  const audioSpeed = Math.round((await playbackSpeed(userId)) * 100);

  return await map(combined, (q) => {
    const quiz = { ...q, quizType: q.repetitions ? q.quizType : "dictation" };
    return prepareQuizData(quiz, audioSpeed);
  });
}
