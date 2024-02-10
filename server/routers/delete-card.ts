import { z } from "zod";
import { procedure } from "../trpc";
export const deleteCard = procedure
  .input(
    z.object({
      id: z.optional(z.number()),
    }),
  )
  .mutation(async (_) => {});
