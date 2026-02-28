import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";

export const editCard = procedure
  .input(
    z.object({
      id: z.number(),
      definition: z.optional(z.string()),
      term: z.optional(z.string()),
      paused: z.optional(z.boolean()),
      repetitions: z.optional(z.number()),
      interval: z.optional(z.number()),
      ease: z.optional(z.number()),
      lapses: z.optional(z.number()),
      lastFailure: z.optional(z.number()),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;

    const card = await prismaClient.card.findFirstOrThrow({
      where: {
        id: input.id,
        userId,
      },
    });

    const data = {
      ...card,
      ...input,
      paused: input.paused ?? card.paused,
    };
    await prismaClient.card.update({ where: { id: card.id }, data });
  });
