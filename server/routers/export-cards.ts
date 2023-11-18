import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";
import { BACKUP_SCHEMA } from "@/pages/cards";
import { getUserSettings } from "../auth-helpers";

export const exportCards = procedure
  .input(z.object({}))
  .output(BACKUP_SCHEMA)
  .mutation(async ({ ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;

    const allCards = prismaClient.card.findMany({
      where: {
        flagged: false,
        userId,
      },
      orderBy: {
        id: "asc",
      },
    });
    return (await allCards).map((card) => {
      return {
        term: card.term,
        definition: card.definition,
        repetitions: card.repetitions,
        interval: card.interval,
        ease: card.ease,
        lapses: card.lapses,
        nextReviewAt: card.nextReviewAt,
        createdAt: card.createdAt,
        firstReview: card.firstReview,
        lastReview: card.lastReview,
      };
    });
  });
