import { map, shuffle, unique } from "radash";
import { errorReport } from "./error-report";
import { prismaClient } from "@/koala/prisma-client";
import { generateLessonAudio } from "./speech";
import { LessonType } from "./shared-types";
import { maybeGetCardImageUrl } from "./image";

type GetLessonInputParams = {
  userId: string;
  /** Current time */
  now: number;
  /** Max number of cards to return */
  take: number;
  /** IDs that are already in the user's hand. */
  notIn: number[];
};

async function getExcludedIDs(wantToExclude: number[]) {
  if (!wantToExclude.length) return Promise.resolve([]);
  const quizzes = prismaClient.quiz;

  return (
    await quizzes.findMany({
      where: {
        cardId: {
          in: (
            await quizzes.findMany({
              where: {
                id: { in: wantToExclude },
              },
              select: { cardId: true },
            })
          ).map(({ cardId }) => cardId),
        },
      },
      select: { id: true },
    })
  ).map(({ id }) => id);
}

export const numberOfCardsCanStudy = async (
  userId: string,
  yesterday: number,
) => {
  const settings = await prismaClient.userSettings.findFirst({
    where: { userId },
  });
  const maxCards = settings?.cardsPerDayMax || 1000;
  const actualCards = await prismaClient.quiz.count({
    where: {
      Card: {
        userId,
        flagged: { not: true },
      },
      lastReview: {
        gte: yesterday,
      },
    },
  });
  const allowedCards = maxCards - actualCards;
  return Math.max(allowedCards, 0);
};

type QuizLike = { quizType: string };

function redistributeQuizzes<T extends QuizLike>(quizzes: T[]): T[] {
  // Step 1: Categorize quizzes into separate arrays based on `quizType`.
  const categorized: Record<string, T[]> = {};

  quizzes.forEach((quiz) => {
    if (!categorized[quiz.quizType]) {
      categorized[quiz.quizType] = [];
    }
    categorized[quiz.quizType].push(quiz);
  });

  // Step 2: Rebuild the array by picking elements in a round robin fashion.
  const result: T[] = [];
  let keys = Object.keys(categorized);
  let index = 0;

  while (keys.some((key) => categorized[key].length > 0)) {
    const currentKey = keys[index % keys.length];
    if (categorized[currentKey].length > 0) {
      result.push(categorized[currentKey].shift()!);
    }
    index++;
  }

  return result;
}

export default async function getLessons(p: GetLessonInputParams) {
  if (p.take > 15) {
    return errorReport("Too many cards requested.");
  }
  const yesterday = new Date().getTime() - 24 * 60 * 60 * 1000;
  const excluded = await getExcludedIDs(p.notIn);
  // SELECT * from public."Quiz" order by "nextReview" desc, "cardId" desc, "quizType" asc;
  const quizzes = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: p.userId,
        flagged: { not: true },
      },
      ...(excluded.length ? { id: { notIn: excluded } } : {}),
      nextReview: {
        lt: p.now || Date.now(),
      },
      lastReview: {
        lt: yesterday,
      },
    },
    orderBy: [
      { Card: { langCode: "desc" } },
      { nextReview: "desc" },
      { cardId: "asc" },
      { quizType: "asc" },
    ],
    take: 45, // Will be filtered to correct length later.
    include: {
      Card: true, // Include related Card data in the result
    },
  });

  const maxCards = await numberOfCardsCanStudy(p.userId, yesterday);
  const shuffled = unique(shuffle(quizzes), (q) => q.cardId);
  const filtered = redistributeQuizzes(shuffled)
    .slice(0, maxCards)
    .slice(0, p.take);
  return await map(filtered, async (quiz) => {
    const audio = await generateLessonAudio({
      card: quiz.Card,
      lessonType: quiz.quizType as LessonType,
      speed: 100,
    });
    return {
      quizId: quiz.id,
      cardId: quiz.cardId,
      definition: quiz.Card.definition,
      term: quiz.Card.term,
      repetitions: quiz.repetitions,
      lapses: quiz.lapses,
      lessonType: quiz.quizType as LessonType,
      audio,
      langCode: quiz.Card.langCode,
      lastReview: quiz.lastReview || 0,
      imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
    };
  });
}
