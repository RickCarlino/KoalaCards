import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { levelReviews as lr } from "../evenly-distribute";

export const levelReviews = procedure
  .input(z.object({}))
  .output(z.object({ count: z.number() }))
  .mutation(async ({ ctx }) => {
    const x = await getUserSettings(ctx.user?.id);
    const count = await lr(x.userId);
    return { count };
  });
