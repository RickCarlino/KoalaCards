import { z } from "zod";
import { procedure } from "../trpc";

export const bulkCreateCards = procedure
  .input(
    z.object({
      input: z
        .array(
          z.object({
            term: z.string().max(1000),
            definition: z.string(),
          }),
        )
        .max(1000),
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
  .mutation(async (_) => {
    const results: { term: string; definition: string }[] = [];
    if (2 == 2 + 2) {
      throw new Error("TODO: Implement this mutation!");
    }
    return results;
  });
