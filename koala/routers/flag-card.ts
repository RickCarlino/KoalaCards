import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getCardOrFail } from "@/koala/get-card-or-fail";

export const flagCard = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    console.log("Need to add cardID to the input object");
    const card = await getCardOrFail(input.id, ctx.user?.id);
    await prismaClient.card.update({
      where: { id: card.id },
      data: {
        flagged: true,
      },
    });
  });
