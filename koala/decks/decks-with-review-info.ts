import { prismaClient } from "../prisma-client";

export type DeckWithReviewInfo = {
  id: number;
  deckName: string;
  quizzesDue: number;
  newQuizzes: number;
};

const fetchDueQuizzes = (userId: string) => {
  const criteria = {
    nextReview: { lt: Date.now() },
    repetitions: { gt: 0 },
    Card: {
      flagged: false,
      Deck: { userId },
    },
  };
  return prismaClient.quiz.groupBy({
    by: ["cardId"],
    where: criteria,
    _count: { _all: true },
  });
};

const fetchNewQuizzes = (userId: string) => {
  const criteria = {
    repetitions: 0,
    Card: {
      flagged: false,
      Deck: { userId },
    },
  };
  return prismaClient.quiz.groupBy({
    by: ["cardId"],
    where: criteria,
    _count: { _all: true },
  });
};

const fetchCardToDeckMap = async (cardIds: number[]) => {
  const mappings = await prismaClient.card.findMany({
    where: { id: { in: cardIds } },
    select: { id: true, deckId: true },
  });
  return Object.fromEntries(mappings.map((m) => [m.id, m.deckId]));
};

const fetchUserDecks = (userId: string) =>
  prismaClient.deck.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

export const decksWithReviewInfo = async (userId: string): Promise<DeckWithReviewInfo[]> => {
  const [dueQuizzes, newQuizzes] = await Promise.all([
    fetchDueQuizzes(userId),
    fetchNewQuizzes(userId),
  ]);

  const allCardIds = [...dueQuizzes, ...newQuizzes].map((q) => q.cardId);
  const cardToDeck = await fetchCardToDeckMap(allCardIds);

  const quizCounts: Record<number, { due: number; new: number }> = {};

  const accumulateCounts = (
    quizzes: { cardId: number; _count: { _all: number } }[],
    key: "due" | "new"
  ) => {
    for (const quiz of quizzes) {
      const deckId = cardToDeck[quiz.cardId];
      if (!deckId) continue;
      if (!quizCounts[deckId]) {
        quizCounts[deckId] = { due: 0, new: 0 };
      }
      quizCounts[deckId][key] += quiz._count?._all || 0;
    }
  };

  accumulateCounts(dueQuizzes, "due");
  accumulateCounts(newQuizzes, "new");

  const decks = await fetchUserDecks(userId);
  return decks.map((deck) => ({
    id: deck.id,
    deckName: deck.name,
    quizzesDue: quizCounts[deck.id]?.due || 0,
    newQuizzes: quizCounts[deck.id]?.new || 0,
  }));
};
