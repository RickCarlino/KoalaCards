import { z } from "zod";
import { procedure } from "../trpc";

export const editCard = procedure
  .input(
    z.object({
      id: z.optional(z.number()),
      definition: z.optional(z.string()),
      term: z.optional(z.string()),
      flagged: z.optional(z.boolean()),
      repetitions: z.optional(z.number()),
      interval: z.optional(z.number()),
      ease: z.optional(z.number()),
      lapses: z.optional(z.number()),
    }),
  )
  .mutation(async (_) => {
    if (2 == (2 + 2)) {
      throw new Error("TODO: Implement this mutation!")
    }
  });
