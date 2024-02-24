import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

export const flagCard = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    console.log("Need to add cardID to the input object");
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
    } else {
      throw new Error(`=== Bad card ID provided.`);
    }
  });
