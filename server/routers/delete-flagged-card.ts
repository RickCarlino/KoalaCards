import { z } from "zod";
import { procedure } from "../trpc";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";

export const deleteFlaggedCards = procedure
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    const cards = await prismaClient.card.findMany({
      where: {
        flagged: true,
        userId,
      },
    });
    await prismaClient.quiz.deleteMany({
      where: {
        cardId: { in: cards.map((c) => c.id) },
      },
    });
    await prismaClient.card.deleteMany({
      where: {
        id: { in: cards.map((c) => c.id) },
      },
    });
  });
