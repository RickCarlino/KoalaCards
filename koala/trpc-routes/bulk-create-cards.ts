import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { backfillDecks } from "../decks/backfill-decks";

export const LANG_CODES = z.union([
  z.literal("es"),
  z.literal("fr"),
  z.literal("it"),
  z.literal("ko"),
]);

export const bulkCreateCards = procedure
  .input(
    z.object({
      cardType: z.string(),
      langCode: LANG_CODES,
      // deckId: z.number(),
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
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }
    for (const i of input.input) {
      const { term: foreignLanguage, definition: english, gender } = i;
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
        const DEFAULTS = ["listening", "speaking"];
        const TYPES: Record<string, string[]> = {
          listening: ["listening"],
          speaking: ["speaking"],
        };
        const quizTypes = TYPES[input.cardType] || DEFAULTS;
        console.log(`=== CREATE QUIZES FOR ${quizTypes.sort().join(", ")} ===`);
        quizTypes.map(async (quizType) => {
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
    await backfillDecks(userId);
    return results;
  });
