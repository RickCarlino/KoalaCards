import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";

export const LANG_CODES = z.union([
  z.literal("es"),
  z.literal("fr"),
  z.literal("it"),
  z.literal("ko"),
]);

export const bulkCreateCards = procedure
  .input(
    z.object({
      langCode: LANG_CODES,
      input: z
        .array(
          z.object({
            term: z.string().max(200),
            definition: z.string().max(200),
            gender: z.union([z.literal("M"), z.literal("F"), z.literal("N")]),
          }),
        )
        .max(3000),
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
    for (const i of input.input) {
      const userId = ctx.user?.id;
      const { term: foreignLanguage, definition: english, gender } = i;
      if (userId) {
        const alreadyExists = await prismaClient.card.findFirst({
          where: {
            userId,
            term: foreignLanguage,
          },
        });
        if (!alreadyExists) {
          const data = {
            userId,
            langCode: input.langCode,
            term: foreignLanguage,
            definition: english,
            gender,
          };
          console.log("Creating card:", data);
          const card = await prismaClient.card.create({
            data,
          });
          ["listening", "speaking"].map(async (quizType) => {
            await prismaClient.quiz.create({
              data: {
                cardId: card.id,
                quizType,
                stability: 0,
                difficulty: 0,
                firstReview: 0,
                lastReview: 0,
                nextReview: 0,
                lapses: 0,
                repetitions: 0,
              },
            });
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
