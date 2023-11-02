import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

export const flagPhrase = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const card = await prismaClient.card.findFirst({
      where: {
        id: input.id,
        userId: ctx.user?.id || "0",
      },
    });
    if (card) {
      await prismaClient.card.update({
        where: { id: card.id },
        data: {
          flagged: true,
        },
      });
    }
  });
