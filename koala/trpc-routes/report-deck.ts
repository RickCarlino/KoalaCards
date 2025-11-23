import { z } from "zod";
import { procedure } from "../trpc-procedure";
export const reportDeck = procedure
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
