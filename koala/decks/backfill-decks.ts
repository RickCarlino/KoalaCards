import { prismaClient } from "../prisma-client";

export async function backfillDecks(userID: string) {
  const cards = await prismaClient.card.findMany({
    where: {
      userId: userID,
      deckId: null,
    },
  });

  if (cards.length === 0) {
    return;
  }

  const deckName = "Korean Deck";
  let deck = await prismaClient.deck.findFirst({
    where: { userId: userID, name: deckName },
  });

  if (!deck) {
    deck = await prismaClient.deck.create({
      data: { userId: userID, name: deckName },
    });
  }

  await prismaClient.card.updateMany({
    where: { id: { in: cards.map((c) => c.id) } },
    data: { deckId: deck.id },
  });
}
