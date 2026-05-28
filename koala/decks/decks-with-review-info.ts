import { getLessonsDue } from "../fetch-lesson";
import { ensureDeckFsrsConfig } from "../fsrs/scheduler";
import { prismaClient } from "../prisma-client";

export type DeckWithReviewInfo = {
  id: number;
  name: string;
  description: string | null;
  quizzesDue: number;
  newQuizzes: number;
  requestedRetention: number;
  optimizerStatus: string;
  optimizerError: string | null;
  eligibleLogCount: number;
  lastOptimizedAt: string | null;
};

const fetchUserDecks = (userId: string) =>
  prismaClient.deck.findMany({
    where: { userId },
    select: { id: true, name: true, description: true },
  });

const newCardCount = async (deckId: number) => {
  return prismaClient.card.count({
    where: { deckId, paused: { not: true }, lastReview: 0 },
  });
};

export const decksWithReviewInfo = async (
  userId: string,
): Promise<DeckWithReviewInfo[]> => {
  const decks = await fetchUserDecks(userId);
  return Promise.all(
    decks.map(async (deck) => {
      const fsrsConfig = await ensureDeckFsrsConfig(prismaClient, {
        userId,
        deckId: deck.id,
      });
      return {
        id: deck.id,
        name: deck.name,
        description: deck.description ?? null,
        quizzesDue: (await getLessonsDue(deck.id)) || 0,
        newQuizzes: (await newCardCount(deck.id)) || 0,
        requestedRetention: fsrsConfig.requestedRetention,
        optimizerStatus: fsrsConfig.optimizerStatus ?? "idle",
        optimizerError: fsrsConfig.optimizerError,
        eligibleLogCount: fsrsConfig.eligibleLogCount,
        lastOptimizedAt: fsrsConfig.lastOptimizedAt?.toISOString() ?? null,
      };
    }),
  );
};
