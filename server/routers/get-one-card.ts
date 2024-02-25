import { z } from "zod";
import { procedure } from "../trpc";
import { getCardOrFail } from "@/utils/get-card-or-fail";

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
  .query(async ({ input, ctx }) => {
    const card = await getCardOrFail(input.id, ctx.user?.id);
    return {
      id: card.id,
      definition: card.definition,
      term: card.term,
      flagged: card.flagged,
    };
  });
