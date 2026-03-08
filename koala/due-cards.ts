import { prismaClient } from "@/koala/prisma-client";

export const getDueCardsCount = async (
  userId: string,
  nowMs: number,
  deckId?: number,
): Promise<number> => {
  const quizzesDue = await prismaClient.card.count({
    where: {
      userId,
      paused: { not: true },
      ...(deckId ? { deckId } : {}),
      nextReview: { lt: nowMs },
      firstReview: { gt: 0 },
    },
  });

  const reviewsDue = await prismaClient.card.count({
    where: {
      userId,
      paused: { not: true },
      lastFailure: { not: 0 },
    },
  });

  return quizzesDue + reviewsDue;
};
