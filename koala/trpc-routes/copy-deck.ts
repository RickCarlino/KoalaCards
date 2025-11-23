import { z } from "zod";
import { procedure } from "../trpc-procedure";
export const copyDeck = procedure
  .input(
    z.object({
      deckId: z.number(),
    }),
  )
  .output(z.void())
  .mutation(async ({ input, ctx }) => {
    void input;
    void ctx;
  });
