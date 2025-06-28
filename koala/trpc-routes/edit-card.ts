import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { errorReport } from "@/koala/error-report";

export const editCard = procedure
  .input(
    z.object({
      id: z.number(),
      definition: z.optional(z.string()),
      term: z.optional(z.string()),
      flagged: z.optional(z.boolean()),
      repetitions: z.optional(z.number()),
      interval: z.optional(z.number()),
      ease: z.optional(z.number()),
      lapses: z.optional(z.number()),
      lastFailure: z.optional(z.number()),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    console.log("editCard mutation called with input:", input);
    try {
      const userId = (await getUserSettings(ctx.user?.id)).user.id;

      const card = await prismaClient.card.findFirstOrThrow({
        where: {
          id: input.id,
          userId,
        },
      });

      const data = {
        ...card,
        ...input,
        flagged: input.flagged ?? false,
      };
      console.log("Updating card with data:", data);
      await prismaClient.card.update({ where: { id: card.id }, data });
    } catch (error) {
      console.error("Error in editCard mutation:", error);
      return errorReport(`Failed to edit card: ${error}`);
    }
  });
