import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

export const editCard = procedure
  .input(
    z.object({
      id: z.optional(z.number()),
      definition: z.optional(z.string()),
      term: z.optional(z.string()),
      flagged: z.optional(z.boolean()),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }

    const card = await prismaClient.card.findFirst({
      where: {
        id: input.id,
        userId,
        flagged: false,
      },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    await prismaClient.card.update({
      where: { id: card.id },
      data: {
        term: input.term ?? card.term,
        definition: input.definition ?? card.definition,
        flagged: input.flagged ?? false,
      },
    });
  });
