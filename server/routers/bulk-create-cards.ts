import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

export const bulkCreateCards = procedure
  .input(
    z.object({
      // Koala does not actually support Spanish.
      // It's a placeholder.
      langCode: z.union([z.literal("ko"), z.literal("TODO: Support other langauges.")]),
      input: z
        .array(
          z.object({
            term: z.string().max(1000),
            definition: z.string(),
          }),
        )
        .max(1000),
    }),
  )
  .output(
    z.array(
      z.object({
        term: z.string(),
        definition: z.string(),
      }),
    ),
  )
  .mutation(async ({ input, ctx }) => {
    const results: { term: string; definition: string }[] = [];
    for (const { term: foreignLanguage, definition: english } of input.input) {
      const userId = ctx.user?.id;
      if (userId) {
        const alreadyExists = await prismaClient.card.findFirst({
          where: {
            userId,
            term: foreignLanguage,
          },
        });
        if (!alreadyExists) {
          await prismaClient.card.create({
            data: {
              userId,
              langCode: input.langCode,
              term: foreignLanguage,
              definition: english,
            },
          });
          results.push({
            term: foreignLanguage,
            definition: english,
          });
        } else {
          const ERR = "(Duplicate) ";
          results.push({
            term: ERR + foreignLanguage,
            definition: ERR + english,
          });
        }
      }
    }
    return results;
  });
