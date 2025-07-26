import { getLessonsDue } from "../fetch-lesson";
import { prismaClient } from "../prisma-client";

export type DeckWithReviewInfo = {
  id: number;
  name: string;
  quizzesDue: number;
  newQuizzes: number;
  published: boolean;
};

const fetchUserDecks = (userId: string) =>
  prismaClient.deck.findMany({
    where: { userId },
    select: { id: true, name: true, published: true },
  });

const newCardCount = async (deckId: number) => {
  return prismaClient.quiz.count({
    where: {
      lastReview: 0,
      Card: {
        deckId,
        flagged: { not: true },
      },
    },
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
      quizzesDue: (await getLessonsDue(deck.id)) || 0,
      newQuizzes: (await newCardCount(deck.id)) || 0,
      published: deck.published,
    })),
  );
};
