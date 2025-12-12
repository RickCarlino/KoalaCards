import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { DeckExport } from "../types/deck-export";
import { normalizeGender } from "../types/gender";

export const exportDeck = procedure
  .input(z.object({ deckId: z.number() }))
  .mutation(async ({ input, ctx }): Promise<DeckExport> => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const deck = await prismaClient.deck.findUnique({
      where: { id: input.deckId, userId },
      include: { Card: true },
    });

    if (!deck) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deck not found",
      });
    }

    const { Card: cards } = deck;

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      cards: cards.map(
        ({
          userId: _cardUserId,
          deckId: _cardDeckId,
          id: _id,
          term,
          definition,
          gender,
          flagged,
          imageBlobId,
          stability,
          difficulty,
          firstReview,
          lastReview,
          nextReview,
          lapses,
          repetitions,
          lastFailure,
          createdAt,
        }) => ({
          term,
          definition,
          gender: normalizeGender(gender),
          flagged,
          imageBlobId,
          stability,
          difficulty,
          firstReview,
          lastReview,
          nextReview,
          lapses,
          repetitions,
          lastFailure,
          createdAt: createdAt.toISOString(),
        }),
      ),
    };
  });
