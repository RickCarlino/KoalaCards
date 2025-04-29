import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { TRPCError } from "@trpc/server";

export const mergeDecks = procedure
  .input(
    z.object({
      deckIds: z.array(z.number()).min(2), // At least 2 decks to merge
      newDeckName: z.string().min(1),
    }),
  )
  .output(z.object({
    newDeckId: z.number(),
    cardsUpdated: z.number(),
  }))
  .mutation(async ({ input, ctx }) => {
    const userSettings = await getUserSettings(ctx.user?.id);
    const userId = userSettings.user.id;

    // Verify all decks exist and belong to the current user
    const decks = await prismaClient.deck.findMany({
      where: {
        id: { in: input.deckIds },
        userId,
      },
    });

    // If not all decks were found, the user doesn't own some of the requested decks
    if (decks.length !== input.deckIds.length) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have access to one or more of the selected decks",
      });
    }

    // Get the language code from the first deck (assuming all decks have the same language)
    const langCode = decks[0].langCode;

    // Verify all decks have the same language
    if (!decks.every(deck => deck.langCode === langCode)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "All decks must be in the same language",
      });
    }

    // Execute the merge operation in a transaction
    const result = await prismaClient.$transaction(async (tx) => {
      // Create the new deck
      const newDeck = await tx.deck.create({
        data: {
          name: input.newDeckName,
          langCode,
          userId,
          published: false,
        },
      });

      // Update all cards from the source decks to point to the new deck
      const updateResult = await tx.card.updateMany({
        where: {
          userId,
          deckId: { in: input.deckIds },
        },
        data: {
          deckId: newDeck.id,
        },
      });

      // Delete the source decks
      await tx.deck.deleteMany({
        where: {
          id: { in: input.deckIds },
          userId,
        },
      });

      return {
        newDeckId: newDeck.id,
        cardsUpdated: updateResult.count,
      };
    });

    return result;
  });