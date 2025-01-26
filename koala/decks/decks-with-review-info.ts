import { prismaClient } from "../prisma-client";

type FnInput = string; // userId

export type DeckWithReviewInfo = {
  id: number;
  deckName: string;
  quizzesDue: number;
  newQuizzes: number;
};

type QueryFn = (input: FnInput) => Promise<DeckWithReviewInfo[]>;

export const decksWithReviewInfo: QueryFn = async (userId: string) => {
  // Step 1: Group quizzes by deckId where quizzes are due
  const dueQuizzes = await prismaClient.quiz.groupBy({
    by: ["cardId"],
    where: {
      nextReview: {
        lt: Date.now(),
      },
      repetitions: {
        gt: 0,
      },
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

  // Step 2: Identify "new" quizzes (quizzes with 0 repetitions and not flagged)
  const newQuizzes = await prismaClient.quiz.groupBy({
    by: ["cardId"],
    where: {
      repetitions: 0,
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

  // Step 3: Map cardId to deckId for due quizzes
  const cardIds = dueQuizzes.map((q) => q.cardId);
  const newCardIds = newQuizzes.map((q) => q.cardId);

  // Step 4: Retrieve deckId for each cardId
  const cards = await prismaClient.card.findMany({
    where: {
      id: { in: [...cardIds, ...newCardIds] },
    },
    select: {
      id: true,
      deckId: true,
    },
  });

  // Step 5: Aggregate quizzes due and new quizzes per deck
  const deckQuizMap: Record<
    number,
    { quizzesDue: number; newQuizzes: number }
  > = {};

  dueQuizzes.forEach((q) => {
    const card = cards.find((c) => c.id === q.cardId);
    if (card) {
      if (!deckQuizMap[card.deckId!]) {
        deckQuizMap[card.deckId!] = { quizzesDue: 0, newQuizzes: 0 };
      }
      deckQuizMap[card.deckId!].quizzesDue += q._count!._all;
    }
  });

  newQuizzes.forEach((q) => {
    const card = cards.find((c) => c.id === q.cardId);
    if (card) {
      if (!deckQuizMap[card.deckId!]) {
        deckQuizMap[card.deckId!] = { quizzesDue: 0, newQuizzes: 0 };
      }
      deckQuizMap[card.deckId!].newQuizzes += q._count!._all;
    }
  });

  // Step 6: Retrieve deck details
  const decks = await prismaClient.deck.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  // Step 7: Combine deck details with quizzesDue and newQuizzes
  const result: DeckWithReviewInfo[] = decks.map((deck) => ({
    id: deck.id,
    deckName: deck.name,
    quizzesDue: deckQuizMap[deck.id]?.quizzesDue || 0,
    newQuizzes: deckQuizMap[deck.id]?.newQuizzes || 0,
  }));

  return result;
};
