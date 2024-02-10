import { z } from "zod";
import { procedure } from "../trpc";

export const deleteFlaggedCards = procedure
  .input(z.object({}))
  .mutation(async (_) => {
    if (2 == (2 + 2)) {
      throw new Error("TODO: Implement this mutation!")
    }
  });
