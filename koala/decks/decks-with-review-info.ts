import { prismaClient } from "../prisma-client";

type FnInput = string; // userId

export type DeckWithReviewInfo = {
  id: number;
  deckName: string;
  quizzesDue: number;
};

type QueryFn = (input: FnInput) => Promise<DeckWithReviewInfo[]>;

/**
 * Retrieves all decks for a given user along with the count of quizzes due in each deck.
 * @param userId - The ID of the user.
 * @returns An array of decks with their respective due quizzes count.
 */
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
        Deck: {
          userId: userId,
        },
      },
    },
    _count: {
      _all: true,
    },
  });

  // Step 2: Map cardId to deckId
  const cardIds = dueQuizzes.map((q) => q.cardId);

  // Step 3: Retrieve deckId for each cardId
  const cards = await prismaClient.card.findMany({
    where: {
      id: { in: cardIds },
    },
    select: {
      id: true,
      deckId: true,
    },
  });

  // Step 4: Aggregate quizzes due per deck
  const deckQuizMap: Record<number, number> = {};

  dueQuizzes.forEach((q) => {
    const card = cards.find((c) => c.id === q.cardId);
    if (card) {
      if (!deckQuizMap[card.deckId!]) {
        deckQuizMap[card.deckId!] = 0;
      }
      deckQuizMap[card.deckId!] += q._count!._all;
    }
  });

  // Step 5: Retrieve deck details
  const decks = await prismaClient.deck.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  // Step 6: Combine deck details with quizzesDue
  const result: DeckWithReviewInfo[] = decks.map((deck) => ({
    id: deck.id,
    deckName: deck.name,
    quizzesDue: deckQuizMap[deck.id] || 0,
  }));

  return result;
};
