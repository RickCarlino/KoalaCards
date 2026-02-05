import { getLessonsDue } from "../fetch-lesson";
import { prismaClient } from "../prisma-client";

export type DeckWithReviewInfo = {
  id: number;
  name: string;
  description: string | null;
  quizzesDue: number;
  newQuizzes: number;
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
    decks.map(async (deck) => ({
      id: deck.id,
      name: deck.name,
      description: deck.description ?? null,
      quizzesDue: (await getLessonsDue(deck.id)) || 0,
      newQuizzes: (await newCardCount(deck.id)) || 0,
    })),
  );
};
