import { z } from "zod";
import { procedure } from "../trpc";
import { prismaClient } from "../prisma-client";

/** Flag cards that are leeches or excessively hard. */
export const flagObnoxious = procedure
  .input(z.object({}))
  .output(z.object({ message: z.string() }))
  .mutation(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      return { message: `["No user ID"]` };
    }
    const { count } = await prismaClient.card.updateMany({
      where: {
        userId,
        OR: [{ lapses: { gte: 7 } }, { ease: { lte: 1.31 } }],
      },
      data: {
        flagged: true,
      },
    });
    return { message: JSON.stringify([`Flagged ${count} cards.`]) };
  });
