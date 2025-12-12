import { getLessons } from "@/koala/fetch-lesson";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { QuizInput, QuizList } from "../types/zod";

export async function getLessonMeta(userId: string, deckId?: number) {
  const currentDate = new Date().getTime();
  const deckWhere = deckId ? { deckId } : {};

  let quizzesDue = await prismaClient.card.count({
    where: {
      userId,
      flagged: { not: true },
      ...deckWhere,
      nextReview: { lt: currentDate },
      firstReview: { gt: 0 },
    },
  });

  const reviewsDue = await prismaClient.card.count({
    where: {
      userId,
      lastFailure: { not: 0 },
      flagged: { not: true },
    },
  });

  const totalCards = await prismaClient.card.count({
    where: { userId, flagged: false, ...deckWhere },
  });

  quizzesDue += reviewsDue;

  const newCards = await prismaClient.card.count({
    where: {
      userId,
      flagged: false,
      ...deckWhere,
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
