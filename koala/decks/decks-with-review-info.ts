import { prismaClient } from "../prisma-client";

export type DeckWithReviewInfo = {
  id: number;
  deckName: string;
  quizzesDue: number;
  newQuizzes: number;
};

type QuizGroup = {
  cardId: number;
  _count: { _all: number } | null;
};

type DeckQuizCounts = {
  quizzesDue: number;
  newQuizzes: number;
};

type CardDeckMap = {
  id: number;
  deckId: number | null;
};

const getQuizGroups = async (userId: string, isDueQuiz: boolean) => {
  return prismaClient.quiz.groupBy({
    by: ["cardId"],
    where: {
      ...(isDueQuiz
        ? {
            nextReview: {
              lt: Date.now(),
            },
            repetitions: {
              gt: 0,
            },
          }
        : {
            repetitions: 0,
          }),
      Card: {
        flagged: false,
        Deck: {
          userId: userId,
        },
      },
    },
    _count: {
      _all: true,
    },
  });
};

const updateDeckQuizMap = (
  quizGroups: QuizGroup[],
  cards: CardDeckMap[],
  deckQuizMap: Record<number, DeckQuizCounts>,
  isDueQuiz: boolean
) => {
  quizGroups.forEach((quiz) => {
    const card = cards.find((c) => c.id === quiz.cardId);
    if (card?.deckId) {
      if (!deckQuizMap[card.deckId]) {
        deckQuizMap[card.deckId] = { quizzesDue: 0, newQuizzes: 0 };
      }
      const count = quiz._count?._all || 0;
      if (isDueQuiz) {
        deckQuizMap[card.deckId].quizzesDue += count;
      } else {
        deckQuizMap[card.deckId].newQuizzes += count;
      }
    }
  });
};

export const decksWithReviewInfo = async (userId: string) => {
  // Get both due and new quizzes
  const [dueQuizzes, newQuizzes] = await Promise.all([
    getQuizGroups(userId, true),
    getQuizGroups(userId, false),
  ]);

  // Get all relevant card IDs and their deck mappings
  const cardIds = [...dueQuizzes, ...newQuizzes].map((q) => q.cardId);
  const cards = await prismaClient.card.findMany({
    where: {
      id: { in: cardIds },
    },
    select: {
      id: true,
      deckId: true,
    },
  });

  // Build the deck quiz map
  const deckQuizMap: Record<number, DeckQuizCounts> = {};
  updateDeckQuizMap(dueQuizzes, cards, deckQuizMap, true);
  updateDeckQuizMap(newQuizzes, cards, deckQuizMap, false);

  // Get deck details and combine with quiz counts
  const decks = await prismaClient.deck.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return decks.map((deck) => ({
    id: deck.id,
    deckName: deck.name,
    quizzesDue: deckQuizMap[deck.id]?.quizzesDue || 0,
    newQuizzes: deckQuizMap[deck.id]?.newQuizzes || 0,
  }));
};
