import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { optimizeDeckFsrs } from "../fsrs/optimizer";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";

export const optimizeDeckFsrsRoute = procedure
  .input(z.object({ deckId: z.number() }))
  .output(
    z.object({
      status: z.enum(["succeeded", "skipped", "failed"]),
      eligibleLogCount: z.number(),
      reason: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const deck = await prismaClient.deck.findUnique({
      where: { id: input.deckId, userId },
      select: { id: true },
    });
    if (!deck) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deck not found",
      });
    }

    const result = await optimizeDeckFsrs({
      userId,
      deckId: input.deckId,
    });
    return {
      status: result.status,
      eligibleLogCount: result.eligibleLogCount,
      reason: result.readiness.reason,
    };
  });
