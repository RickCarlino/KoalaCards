import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { levelReviews as lr } from "../evenly-distribute";

/** The `faucet` route is a mutation that returns a "Hello, world" string
 * and takes an empty object as its only argument. */
export const levelReviews = procedure
  .input(z.object({}))
  .output(z.object({ count: z.number() }))
  .mutation(async ({ ctx }) => {
    const x = await getUserSettings(ctx.user?.id);
    const count = await lr(x.userId);
    return { count };
  });
