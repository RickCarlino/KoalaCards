// import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";
import { BACKUP_SCHEMA } from "@/pages/cards";

export const importCards = procedure
  .input(BACKUP_SCHEMA)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }
    input.forEach(async (card) => {
      console.log(
        `Importing card ${card.term} with definition ${card.definition}`,
      );
    });
  });
