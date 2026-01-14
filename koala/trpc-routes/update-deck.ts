import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { DECK_DESCRIPTION_MAX_LENGTH } from "../decks/constants";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";

export const updateDeck = procedure
  .input(
    z.object({
      deckId: z.number(),
      name: z.string().trim().min(1).max(100),
      description: z
        .string()
        .trim()
        .max(DECK_DESCRIPTION_MAX_LENGTH)
        .nullable()
        .optional(),
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
    const data: { name: string; description?: string | null } = {
      name: input.name,
    };
    if (input.description !== undefined) {
      data.description = input.description || null;
    }
    await prismaClient.deck.update({
      where: { id: input.deckId },
      data,
    });
  });
