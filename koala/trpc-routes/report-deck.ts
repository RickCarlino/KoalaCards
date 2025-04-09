import { z } from "zod";
// import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
// import { getUserSettings } from "../auth-helpers";

export const reportDeck = procedure
  .input(
    z.object({
      deckId: z.number(),
    }),
  )
  .output(z.void())
  .mutation(async ({ input, ctx }) => {
    // Not implemented yet.
    void input;
    void ctx;
  });
