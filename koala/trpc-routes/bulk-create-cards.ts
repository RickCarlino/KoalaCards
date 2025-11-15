import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { backfillDecks } from "../decks/backfill-decks";
import { LANG_CODES } from "../shared-types";
import { TRPCError } from "@trpc/server";
import { maybeAddImageToCard } from "../image";

const inputSchema = z.object({
  deckId: z.number().optional(),
  langCode: LANG_CODES.optional(),
  deckName: z.string().optional(),
  input: z
    .array(
      z.object({
        term: z.string().max(200),
        definition: z.string().max(200),
        gender: z.union([z.literal("M"), z.literal("F"), z.literal("N")]),
      }),
    )
    .max(3000),
});

const outputSchema = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

export const bulkCreateCards = procedure
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

    const results: { term: string; definition: string }[] = [];
    const { deckId: inDeckId, deckName } = input;

    let deck =
      inDeckId &&
      (await prismaClient.deck.findUnique({
        where: { id: inDeckId, userId },
      }));

    if (!deck && deckName) {
      deck =
        (await prismaClient.deck.findFirst({
          where: { userId, name: deckName },
        })) ??
        (await prismaClient.deck.create({
          data: { userId, name: deckName },
        }));
    }

    if (!deck) {
      throw new TRPCError({
        code: inDeckId ? "NOT_FOUND" : "BAD_REQUEST",
        message: inDeckId
          ? `Deck with ID ${inDeckId} not found or access denied.`
          : "Input must include either 'deckId' or 'deckName'.",
      });
    }

    const { id: deckId } = deck;
    let processed = 0;

    for (const { term, definition, gender } of input.input) {
      const duplicate = await prismaClient.card.findFirst({
        where: { userId, term },
      });

      if (duplicate) {
        const prefix = "(Duplicate) ";
        results.push({
          term: prefix + term,
          definition: prefix + definition,
        });
        continue;
      }

      const card = await prismaClient.card.create({
        data: {
          userId,
          term,
          definition,
          deckId,
          gender,
          stability: 0,
          difficulty: 0,
          firstReview: 0,
          lastReview: 0,
          nextReview: 0,
          lapses: 0,
          repetitions: 0,
        },
      });
      results.push({ term, definition });
      processed += 1;
      if (processed < 50) {
        maybeAddImageToCard(card);
      }
    }

    await backfillDecks(userId);
    return results;
  });
