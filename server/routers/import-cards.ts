import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";
import { BACKUP_SCHEMA } from "@/pages/cards";
export const importCards = procedure
  .input(BACKUP_SCHEMA)
  .output(z.object({ count: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }
    let count = 0;
    for (const card of input) {
      const where = { userId, term: card.term };
      const existingCard = await prismaClient.card.count({
        where,
      });
      console.log({ existingCard });
      if (!existingCard) {
        const data = { ...card, ...where };
        await prismaClient.card.create({ data });
        count = count + 1;
      }
    }

    return { count };
  });
