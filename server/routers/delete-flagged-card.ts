import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";
import { getUserSettings } from "../auth-helpers";

export const deleteFlaggedCards = procedure
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;

    await prismaClient.card.deleteMany({
      where: {
        flagged: true,
        userId,
      },
    });
  });
