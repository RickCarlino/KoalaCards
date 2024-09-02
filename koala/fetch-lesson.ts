import { map, shuffle } from "radash";
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

export default async function getLessons(p: GetLessonInputParams) {
  if (p.take > 15) {
    return errorReport("Too many cards requested.");
  }
  const excluded = await getExcludedIDs(p.notIn);
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
    },
    // Unique by cardId
    distinct: ["cardId"],
    orderBy: [{ nextReview: "desc" }],
    take: 45, // Will be filtered to correct length later.
    include: {
      Card: true, // Include related Card data in the result
    },
  });

  return await map(shuffle(quizzes).slice(0, p.take), async (q) => {
    const quiz = {
      ...q,
      quizType: q.lastReview ? q.quizType : "dictation",
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
