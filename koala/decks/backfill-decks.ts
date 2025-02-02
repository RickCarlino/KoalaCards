import { getLangName } from "../get-lang-name";
import { prismaClient } from "../prisma-client";

export async function backfillDecks(userID: string) {
  // Step 1: Find all cards without a deck for the given user
  const cards = await prismaClient.card.findMany({
    where: {
      userId: userID,
      deckId: null,
    },
  });

  // Step 2: Group the cards by `langCode`
  const cardsByLangCode = cards.reduce(
    (acc, card) => {
      if (!acc[card.langCode]) {
        acc[card.langCode] = [];
      }
      acc[card.langCode].push(card);
      return acc;
    },
    {} as Record<string, typeof cards>,
  );

  // Step 3: Iterate through each language group and backfill
  for (const [langCode, cards] of Object.entries(cardsByLangCode)) {
    const languageName = getLangName(langCode);
    // Find or create a deck for the current language
    let deck = await prismaClient.deck.findFirst({
      where: {
        userId: userID,
        name: `${languageName} Deck`,
      },
    });

    if (!deck) {
      deck = await prismaClient.deck.create({
        data: {
          userId: userID,
          langCode,
          name: `${languageName} Deck`,
        },
      });
    }

    // Step 4: Update all cards in the current group with the deckId
    await prismaClient.card.updateMany({
      where: {
        id: { in: cards.map((card) => card.id) },
      },
      data: {
        deckId: deck.id,
      },
    });
  }
}
