import { TRPCError } from "@trpc/server";
import { Rating } from "ts-fsrs";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { setGrade } from "./import-cards";
import { requireRouteUserId } from "./route-helpers";

export const completeRemedialReview = procedure
  .input(z.object({ cardID: z.number().int() }))
  .output(z.object({}))
  .mutation(async ({ ctx, input }) => {
    const userId = requireRouteUserId(ctx.user?.id);
    const card = await prismaClient.card.findFirst({
      where: {
        id: input.cardID,
        userId,
        lastFailure: { gt: 0 },
      },
    });

    if (!card) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Remedial review card not found",
      });
    }

    const now = Date.now();
    if (card.nextReview <= now) {
      const settings = await getUserSettings(userId);
      await setGrade(card, Rating.Good, now, settings.maxLapses);
      return {};
    }

    await prismaClient.card.update({
      where: { id: card.id, userId },
      data: { lastFailure: 0 },
    });
    return {};
  });
