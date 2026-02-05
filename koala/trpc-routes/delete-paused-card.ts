import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";

export const deletePausedCards = procedure
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    const cards = await prismaClient.card.findMany({
      where: {
        paused: true,
        userId,
      },
    });
    await prismaClient.card.deleteMany({
      where: {
        id: { in: cards.map((c) => c.id) },
      },
    });
  });
