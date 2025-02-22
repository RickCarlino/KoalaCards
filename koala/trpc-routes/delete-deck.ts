import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";

export const deleteDeck = procedure
  .input(
    z.object({
      deckId: z.number(),
    }),
  )
  .output(z.void())
  .mutation(async ({ input, ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    await prismaClient.$transaction(async () => {
      await prismaClient.card.deleteMany({
        where: {
          userId,
          deckId: input.deckId,
        },
      });
      await prismaClient.deck.delete({
        where: {
          userId,
          id: input.deckId,
        },
      });
    });
  });
