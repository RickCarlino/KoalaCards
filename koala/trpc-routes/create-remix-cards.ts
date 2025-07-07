import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { backfillDecks } from "../decks/backfill-decks";

export const createRemixCards = procedure
  .input(
    z.object({
      cardId: z.number(),
      remixes: z
        .array(
          z.object({
            term: z.string().max(200),
            definition: z.string().max(200),
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
    await backfillDecks(userId);
    const parent = await prismaClient.card.findFirst({
      where: {
        id: input.cardId,
        userId,
      },
    });

    if (!parent || !parent.deckId) {
      throw new Error("Card not found");
    }

    const deck = await prismaClient.deck.findFirst({
      where: {
        userId,
        id: parent.deckId,
      },
    });

    if (!deck) {
      throw new Error("Deck not found");
    }

    for (const i of input.remixes) {
      const { term: foreignLanguage, definition: english } = i;
      const alreadyExists = await prismaClient.card.findFirst({
        where: {
          userId,
          term: foreignLanguage,
        },
      });
      if (!alreadyExists) {
        const data = {
          userId,
          langCode: parent.langCode,
          term: foreignLanguage,
          definition: english,
          deckId: deck.id,
          gender: "N",
        };
        const card = await prismaClient.card.create({
          data,
        });
        const quizType = "listening";
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
        results.push({
          term: foreignLanguage,
          definition: english,
        });
      }
    }
    return results;
  });
