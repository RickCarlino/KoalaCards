import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getCardOrFail } from "@/koala/get-card-or-fail";

export const flagCard = procedure
  .input(
    z.object({
      cardID: z.number(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const card = await getCardOrFail(input.cardID, ctx.user?.id);
    await prismaClient.card.update({
      where: {
        id: card.id,
      },
      data: {
        flagged: true,
      },
    });
  });
