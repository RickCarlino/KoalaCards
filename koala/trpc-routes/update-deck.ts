import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";

export const updateDeck = procedure
  .input(
    z.object({
      deckId: z.number(),
      published: z.boolean(),
      name: z.string().optional(),
    }),
  )
  .output(z.void())
  .mutation(async ({ input, ctx }) => {
    const userSettings = await getUserSettings(ctx.user?.id);
    const deck = await prismaClient.deck.findUnique({
      where: { id: input.deckId },
    });
    if (!deck || deck.userId !== userSettings.user.id) {
      throw new Error("Not authorized to edit this deck.");
    }
    await prismaClient.deck.update({
      where: { id: input.deckId },
      data: {
        published: input.published,
        ...(input.name ? { name: input.name } : {}),
      },
    });
  });
