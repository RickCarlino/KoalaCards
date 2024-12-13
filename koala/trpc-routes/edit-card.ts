import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { errorReport } from "@/koala/error-report";

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
  .mutation(async ({ input, ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;

    const card = await prismaClient.card.findFirst({
      where: {
        id: input.id,
        userId,
      },
    });

    if (!card) {
      return errorReport(`Card not found: card: ${input.id}, user: ${userId}`);
    }

    await prismaClient.card.update({
      where: { id: card.id },
      data: {
        ...card,
        ...input,
        flagged: input.flagged ?? false,
      },
    });
  });
