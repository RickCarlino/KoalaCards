import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";

export const faucet = procedure
  .input(
    z.object({
      words: z.string(),
    }),
  )
  .output(z.array(z.string()))
  .mutation(async ({ ctx }) => {
    await getUserSettings(ctx.user?.id);
    return [];
  });
