import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { isApprovedUser } from "../is-approved-user";
import { maybeAddImages } from "../image";

/** The `faucet` route is a mutation that returns a "Hello, world" string
 * and takes an empty object as its only argument. */
export const faucet = procedure
  .input(z.object({}))
  .output(z.object({ message: z.string() }))
  .mutation(async ({ ctx }) => {
    const x = await getUserSettings(ctx.user?.id);
    if (isApprovedUser(x.userId)) {
      await maybeAddImages(x.userId, 10);
    }
    return { message: `` };
  });
