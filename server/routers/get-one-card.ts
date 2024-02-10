import { z } from "zod";
import { procedure } from "../trpc";

export const getOneCard = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      definition: z.string(),
      term: z.string(),
      flagged: z.boolean(),
    }),
  )
  .query(async (_) => {
    return {
      id: -1,
      definition: "TODO Definition",
      term: "TODO Term",
      flagged: false,
    };
  });
