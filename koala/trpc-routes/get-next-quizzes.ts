import { getLessons } from "@/koala/fetch-lesson";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { QuizInput, QuizList } from "../types/zod";

export async function getLessonMeta(userId: string, deckId?: number) {
  const currentDate = new Date().getTime(); // Current time in milliseconds

  let quizzesDue = await prismaClient.card.count({
    where: {
      userId,
      flagged: { not: true },
      ...(deckId ? { deckId } : {}),
      nextReview: { lt: currentDate },
      firstReview: { gt: 0 },
    },
  });

  const reviewsDue = await prismaClient.card.count({
    where: {
      userId: userId,
      lastFailure: { not: 0 },
      flagged: { not: true },
    },
  });

  const totalCards = await prismaClient.card.count({
    where: { userId, flagged: false, ...(deckId ? { deckId } : {}) },
  });

  quizzesDue += reviewsDue;

  // Cards that have no quiz yet:
  // Count of Quizzes where repetitions and lapses are 0
  // by distinct cardID
  const newCards = await prismaClient.card.count({
    where: {
      userId,
      flagged: false,
      ...(deckId ? { deckId } : {}),
      repetitions: 0,
      lapses: 0,
    },
  });
  return {
    totalCards,
    quizzesDue,
    newCards,
  };
}

export const getNextQuizzes = procedure
  .input(QuizInput)
  .output(QuizList)
  .mutation(async ({ ctx, input }) => {
    const { user } = await getUserSettings(ctx.user?.id);
    const userId = user.id;
    const quizzes = await getLessons({
      userId,
      deckId: input.deckId,
      now: Date.now(),
      take: input.take,
    });
    return {
      ...(await getLessonMeta(userId, input.deckId)),
      quizzes,
    };
  });
