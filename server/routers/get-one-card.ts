import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";
import { errorReport } from "@/utils/error-report";

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
    const card = await prismaClient.card.findFirst({
      where: {
        id: input.id,
        userId: ctx.user?.id || "000",
      },
    });
    if (!card) {
      return errorReport("Card not found");
    }
    return {
      id: card.id,
      definition: card.definition,
      term: card.term,
      flagged: card.flagged,
    };
  });
