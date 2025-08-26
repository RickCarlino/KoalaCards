import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";

export const faucet = procedure
  .input(z.object({}))
  .output(z.array(z.object({ id: z.number() })))
  .mutation(async ({ ctx }) => {
    const us = await getUserSettings(ctx.user?.id);
    const userdId = us?.userId;
    if (!userdId) {
      return [];
    }
    const cards = await prismaClient.card.findMany({
      where: { userId: userdId },
      take: 10,
    });
    if (cards.length < 10) {
      throw new Error("Need more cards");
    }
    const now = Date.now();
    const remedial = cards.pop();
    if (remedial) {
      console.log("=== Remedial card: " + remedial.term);
      await prismaClient.card.update({
        where: { id: remedial.id },
        data: { lastFailure: now },
      });
    }

    const newCard = cards.pop();
    if (newCard) {
      console.log("=== New quiz: " + newCard.term);
      await prismaClient.card.update({
        where: { id: newCard.id },
        data: {
          stability: 0,
          difficulty: 0,
          firstReview: 0,
          lastReview: 0,
          nextReview: 0,
          lapses: 0,
          repetitions: 0,
        },
      });
    }

    const speakingCard = cards[0];
    if (!speakingCard) {
      throw new Error("Need speaking cards");
    }

    await prismaClient.card.update({
      where: { id: speakingCard.id },
      data: {
        nextReview: now - 24 * 60 * 60 * 1000,
        repetitions: 1,
      },
    });

    return [{ id: 0 }];
  });
