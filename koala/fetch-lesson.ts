import { prismaClient } from "@/koala/prisma-client";
import { map, shuffle } from "radash";
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

async function getReviewCards(userId: string, now: number) {
  return await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: userId,
        flagged: { not: true },
      },
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

  // pruneOldAndHardQuizzes(p.userId);
  const playbackSpeed = await getUserSettings(p.userId).then(
    (s) => s.playbackSpeed || 1.05,
  );
  const playbackPercentage = Math.round(playbackSpeed * 100);
  const reviewCards = await getReviewCards(p.userId, p.now);
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
        lessonType: "speaking",
        speed: 110,
      }),
      termAudio: await generateLessonAudio({
        card: quiz.Card,
        lessonType: "listening",
        speed: playbackPercentage,
      }),
      langCode: quiz.Card.langCode,
      lastReview: quiz.lastReview || 0,
      imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
    };
  });
}
