import { z } from "zod";
import { optimizeDeckFsrs } from "../fsrs/optimizer";
import { procedure } from "../trpc-procedure";
import { requireOwnedDeck, requireRouteUserId } from "./route-helpers";

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
    const userId = requireRouteUserId(ctx.user?.id);
    await requireOwnedDeck({
      where: { id: input.deckId, userId },
      select: { id: true },
    });

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
