import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { LANG_CODES, LangCode } from "../shared-types";
import { TRPCError } from "@trpc/server";

const inputSchema = z.object({
  name: z.string().min(1).max(100),
  langCode: LANG_CODES,
});

const outputSchema = z.object({
  id: z.number(),
  name: z.string(),
  langCode: LANG_CODES,
});

export const createDeck = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const existing = await prismaClient.deck.findFirst({
      where: { userId, name: input.name },
    });

    const deck =
      existing ??
      (await prismaClient.deck.create({
        data: { userId, name: input.name },
        select: { id: true, name: true },
      }));

    const normalized: { id: number; name: string; langCode: LangCode } = {
      id: deck.id,
      name: deck.name,
      langCode: "ko" as LangCode,
    };

    return normalized;
  });
