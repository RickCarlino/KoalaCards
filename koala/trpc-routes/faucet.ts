import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";

/** The `faucet` route is a mutation that returns a "Hello, world" string
 * and takes an empty object as its only argument. */
export const faucet = procedure
  .input(
    z.object({
      cardID: z.string(),
    }),
  )
  .output(
    z.array(
      z.object({
        term: z.string(),
        definition: z.string(),
      }),
    ),
  )
  .mutation(async ({ ctx }) => {
    // I will fill this part out, don't worry about it for now.
    // Show it to you so you understand the schema.
    const x = await getUserSettings(ctx.user?.id);
    console.log(x.userId);
    return [];
  });
