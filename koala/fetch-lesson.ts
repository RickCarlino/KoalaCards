import { prismaClient } from "@/koala/prisma-client";
import { Grade } from "femto-fsrs";
import { map, shuffle } from "radash";
import { getUserSettings } from "./auth-helpers";
import { errorReport } from "./error-report";
import { maybeGetCardImageUrl } from "./image";
import { calculateSchedulingData } from "./routes/import-cards";
import { LessonType } from "./shared-types";
import { generateLessonAudio } from "./speech";

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

async function archiveOld(userId: string) {
  const TOO_EASY = {
    AND: [{ stability: { gt: 365 } }, { repetitions: { gt: 3 } }],
  };
  const fullyLearned = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: userId,
      },
      ...TOO_EASY,
    },
    select: { cardId: true },
  });
  // Now flag:
  await prismaClient.card.updateMany({
    where: {
      id: { in: fullyLearned.map((c) => c.cardId) },
    },
    data: { flagged: true },
  });
}

async function resetHard(userId: string) {
  // Before we get started, let's flag all cards where
  // repetitions > 4 and difficulty > 8.9:

  const tooHard = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: userId,
      },
      difficulty: { gt: 9 },
      repetitions: { gt: 6 },
    },
  });

  const reset = {
    lapses: 0,
    stability: 0,
    difficulty: 0,
    lastReview: 0,
    nextReview: 0,
    firstReview: 0,
    repetitions: 0,
  };

  prismaClient.quiz.updateMany({
    where: {
      id: { in: tooHard.map((c) => c.id) },
    },
    data: {
      ...reset,
      ...calculateSchedulingData(reset, Grade.AGAIN),
    },
  });
}

async function pruneOldAndHardQuizzes(userId: string) {
  await Promise.all([archiveOld(userId), resetHard(userId)]);
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

  pruneOldAndHardQuizzes(p.userId);
  const reviewCards = await getReviewCards(p.userId, p.notIn, p.now);
  const newCards = await getNewCards(p.userId);
  // 25% of cards are new cards.
  const combined = shuffle([...reviewCards, ...newCards]).slice(0, p.take);
  return await map(combined, async (q) => {
    const quiz = {
      ...q,
      quizType: q.repetitions ? q.quizType : "dictation",
    };

    return {
      quizId: quiz.id,
      cardId: quiz.cardId,
      definition: quiz.Card.definition,
      term: quiz.Card.term,
      repetitions: quiz.repetitions,
      lapses: quiz.lapses,
      lessonType: quiz.quizType as LessonType,
      definitionAudio: await generateLessonAudio({
        card: quiz.Card,
        lessonType: "listening",
        speed: 100,
      }),
      termAudio: await generateLessonAudio({
        card: quiz.Card,
        lessonType: "speaking",
      }),
      langCode: quiz.Card.langCode,
      lastReview: quiz.lastReview || 0,
      imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
    };
  });
}
