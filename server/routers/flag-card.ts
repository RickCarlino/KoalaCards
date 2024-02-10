import { z } from "zod";
import { procedure } from "../trpc";

export const flagCard = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .mutation(async (_) => {
    console.log("=== TODO: Implement flagCard ===")
  });
