import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

export const exportCards = procedure
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        definition: z.string(),
        term: z.string(),
        ease: z.number(),
        interval: z.number(),
        lapses: z.number(),
        repetitions: z.number(),
        nextReviewAt: z.number(),
        createdAt: z.nullable(z.date()),
        firstReview: z.nullable(z.date()),
        lastReview: z.nullable(z.date()),
      }),
    ),
  )
  .mutation(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }

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
