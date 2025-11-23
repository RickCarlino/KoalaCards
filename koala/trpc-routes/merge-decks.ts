import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { TRPCError } from "@trpc/server";

export const mergeDecks = procedure
  .input(
    z.object({
      deckIds: z.array(z.number()).min(2),
      newDeckName: z.string().min(1),
    }),
  )
  .output(
    z.object({
      newDeckId: z.number(),
      cardsUpdated: z.number(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userSettings = await getUserSettings(ctx.user?.id);
    const userId = userSettings.user.id;

    const decks = await prismaClient.deck.findMany({
      where: {
        id: { in: input.deckIds },
        userId,
      },
    });

    if (decks.length !== input.deckIds.length) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "You don't have access to one or more of the selected decks",
      });
    }

    const result = await prismaClient.$transaction(async (tx) => {
      const newDeck = await tx.deck.create({
        data: {
          name: input.newDeckName,
          userId,
          published: false,
        },
      });

      await tx.writingSubmission.updateMany({
        where: {
          userId,
          deckId: { in: input.deckIds },
        },
        data: {
          deckId: newDeck.id,
        },
      });

      const updateResult = await tx.card.updateMany({
        where: {
          userId,
          deckId: { in: input.deckIds },
        },
        data: {
          deckId: newDeck.id,
        },
      });

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
