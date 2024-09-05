import { map, shuffle } from "radash";
import { errorReport } from "./error-report";
import { prismaClient } from "@/koala/prisma-client";
import { generateLessonAudio } from "./speech";
import { LessonType } from "./shared-types";
import { maybeGetCardImageUrl } from "./image";
import { getUserSettings } from "./auth-helpers";

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

type CardLike = { repetitions?: number };

type MaybeFilterNewCards = <T extends CardLike>(
  cards: T[],
  userId: string,
) => Promise<T[]>;

const maybeFilterNewCards: MaybeFilterNewCards = async (cards, userId) => {
  const limit = (await getUserSettings(userId)).cardsPerDayMax;
  const ONE_DAY = 1000 * 60 * 60 * 24;
  let newCards = await prismaClient.quiz.count({
    where: {
      Card: {
        userId: userId,
      },
      firstReview: {
        gte: Date.now() - ONE_DAY,
      },
    },
  });
  return cards.filter((c) => {
    const isNew = (c.repetitions || 0) === 0;
    if (isNew) {
      newCards++;
      return newCards <= limit;
    } else {
      return true;
    }
  });
};

async function flagCertainCards(userId: string) {
  // Before we get started, let's flag all cards where
  // repetitions > 4 and difficulty > 8.9:
  const cardsToFlag = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: userId,
      },
      OR: [
        // Too easy, consider these "learned":
        { AND: [{ stability: { gt: 200 } }, { repetitions: { gt: 3 } }] },
        // Too hard, consider these "leeches":
        { AND: [{ difficulty: { gt: 9 } }, { repetitions: { gt: 6 } }] },
      ],
    },
    select: { cardId: true },
  });

  // Now flag:
  await prismaClient.card.updateMany({
    where: {
      id: { in: cardsToFlag.map((c) => c.cardId) },
    },
    data: { flagged: true },
  });
}

async function getReviewCards(userId: string, notIn: number[], now: number) {
  const excluded = await getExcludedIDs(notIn);
  return await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: userId,
        flagged: { not: true },
      },
      ...(excluded.length ? { id: { notIn: excluded } } : {}),
      nextReview: {
        lt: now,
      },
      repetitions: {
        gt: 0,
      },
    },
    distinct: ["cardId"],
    orderBy: [{ quizType: "asc" }],
    take: 15,
    include: {
      Card: true, // Include related Card data in the result
    },
  });
}

async function getNewCards(userId: string) {
  const cards = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: userId,
        flagged: { not: true },
      },
      repetitions: 0,
    },
    distinct: ["cardId"],
    orderBy: [{ quizType: "asc" }],
    take: 5,
    include: {
      Card: true, // Include related Card data in the result
    },
  });
  return maybeFilterNewCards(cards, userId);
}

export default async function getLessons(p: GetLessonInputParams) {
  if (p.take > 15) {
    return errorReport("Too many cards requested.");
  }

  flagCertainCards(p.userId);
  const reviewCards = await getReviewCards(p.userId, p.notIn, p.now);
  const newCards = await getNewCards(p.userId);
  // 25% of cards are new cards.
  const combined = shuffle([...reviewCards, ...newCards]).slice(0, p.take);
  return await map(combined, async (q) => {
    const quiz = {
      ...q,
      quizType: q.repetitions ? q.quizType : "dictation",
    };

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
