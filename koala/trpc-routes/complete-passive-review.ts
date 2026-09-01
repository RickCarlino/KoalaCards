import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { getPassiveReviewEligibility } from "../review/passive-review";
import { procedure } from "../trpc-procedure";
import { requireRouteUserId } from "./route-helpers";

export const completePassiveReview = procedure
  .input(
    z.object({
      cardID: z.number().int(),
      deckId: z.number().int(),
    }),
  )
  .output(z.object({}))
  .mutation(async ({ ctx, input }) => {
    const userId = requireRouteUserId(ctx.user?.id);
    const result = await prismaClient.card.updateMany({
      where: {
        id: input.cardID,
        ...getPassiveReviewEligibility(userId, input.deckId),
      },
      data: { lastPassiveReviewAt: new Date() },
    });

    if (result.count !== 1) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Passive review card not found",
      });
    }

    return {};
  });
