import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

export const importCards = procedure
  .input(
    z.object({
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
    for (const { term: korean, definition: english } of input.input) {
      const userId = ctx.user?.id;
      if (userId) {
        const alreadyExists = await prismaClient.card.findFirst({
          where: {
            userId,
            term: korean,
          },
        });
        if (!alreadyExists) {
          await prismaClient.card.create({
            data: {
              userId,
              term: korean,
              definition: english,
            },
          });
          results.push({
            term: korean,
            definition: english,
          });
        } else {
          const ERR = "(Duplicate) ";
          results.push({
            term: ERR + korean,
            definition: ERR + english,
          });
        }
      }
    }
    return results;
  });
