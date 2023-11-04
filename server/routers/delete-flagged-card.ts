import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

export const deleteFlaggedCards = procedure
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }

    await prismaClient.card.deleteMany({
      where: {
        flagged: true,
        userId,
      },
    });
  });
