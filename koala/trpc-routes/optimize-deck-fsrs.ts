import { z } from "zod";
import { optimizeDeckFsrs } from "../fsrs/optimizer";
import { procedure } from "../trpc-procedure";
import { requireOwnedDeck, requireRouteUserId } from "./route-helpers";

const optimizationReasonSchema = z.enum([
  "eligible",
  "not_enough_logs",
  "not_enough_cards",
  "not_enough_new_logs",
  "cooldown",
]);

export const optimizeDeckFsrsRoute = procedure
  .input(z.object({ deckId: z.number() }))
  .output(
    z.object({
      status: z.enum(["succeeded", "skipped", "failed"]),
      eligibleLogCount: z.number(),
      reason: optimizationReasonSchema,
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
