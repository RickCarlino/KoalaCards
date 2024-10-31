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
    orderBy: [{ quizType: "asc" }, { lastReview: "asc" }],
    take: 15,
    include: {
      Card: true, // Include related Card data in the result
    },
  });
}

async function getNewCards(userId: string, take: number) {
  if (take == 0) {
    return [];
  }

  return await prismaClient.quiz.findMany({
    where: {
      repetitions: { gt: 0 },
      Card: {
        userId: userId,
        flagged: { not: true },
      },
    },
    distinct: ["cardId"],
    orderBy: [{ quizType: "asc" }],
    include: { Card: true },
    take,
  });
}

export default async function getLessons(p: GetLessonInputParams) {
  if (p.take > 15) {
    return errorReport("Too many cards requested.");
  }

  // pruneOldAndHardQuizzes(p.userId);
  const playbackSpeed = await getUserSettings(p.userId).then(
    (s) => s.playbackSpeed || 1.05,
  );
  const oldCards = await getReviewCards(p.userId, p.now);
  const newCards = await getNewCards(p.userId, p.take - oldCards.length);
  const combined = shuffle([...oldCards, ...newCards]).slice(0, p.take);
  const playbackPercentage = Math.round(playbackSpeed * 100);
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
