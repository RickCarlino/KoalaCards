import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { errorReport } from "@/koala/error-report";
import { findOwnedCard, getSettingsUserId } from "./route-helpers";

export const deleteCard = procedure
  .input(
    z.object({
      id: z.optional(z.number()),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = await getSettingsUserId(ctx.user?.id);
    const card = await findOwnedCard({ cardId: input.id, userId });

    if (!card) {
      return errorReport("Card not found");
    }

    await prismaClient.card.delete({
      where: { id: card.id },
    });
  });
