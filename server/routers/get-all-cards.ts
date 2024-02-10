import { z } from "zod";
import { procedure } from "../trpc";

export const getAllCards = procedure
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.number(),
        flagged: z.boolean(),
        term: z.string(),
        definition: z.string(),
      }),
    ),
  )
  .query(async (_) => {
    return [];
  });
