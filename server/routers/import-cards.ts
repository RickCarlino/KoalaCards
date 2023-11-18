import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";
import { BACKUP_SCHEMA } from "@/pages/cards";
import { getUserSettings } from "../auth-helpers";
export const importCards = procedure
  .input(BACKUP_SCHEMA)
  .output(z.object({ count: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    let count = 0;
    for (const card of input) {
      const where = { userId, term: card.term };
      const existingCard = await prismaClient.card.count({
        where,
      });
      if (!existingCard) {
        const data = { ...card, ...where };
        await prismaClient.card.create({ data });
        count = count + 1;
      }
    }

    return { count };
  });
