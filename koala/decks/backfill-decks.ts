import { prismaClient } from "../prisma-client";

export async function backfillDecks(userID: string) {
  // Find all cards without a deck for the given user
  const cards = await prismaClient.card.findMany({
    where: {
      userId: userID,
      deckId: null,
    },
  });

  if (cards.length === 0) {
    return;
  }

  // Single-language app: ensure a single default deck for Korean
  const deckName = "Korean Deck";
  let deck = await prismaClient.deck.findFirst({
    where: { userId: userID, name: deckName },
  });

  if (!deck) {
    deck = await prismaClient.deck.create({
      data: { userId: userID, name: deckName },
    });
  }

  // Assign all orphaned cards to the default deck
  await prismaClient.card.updateMany({
    where: { id: { in: cards.map((c) => c.id) } },
    data: { deckId: deck.id },
  });
}
