import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { DeckExport } from "../types/deck-export";
import { requireOwnedDeck, requireRouteUserId } from "./route-helpers";

export const exportDeck = procedure
  .input(z.object({ deckId: z.number() }))
  .mutation(async ({ input, ctx }): Promise<DeckExport> => {
    const userId = requireRouteUserId(ctx.user?.id);
    const deck = await requireOwnedDeck({
      where: { id: input.deckId, userId },
      include: { Card: true },
    });

    const { Card: cards } = deck;

    return {
      version: 3,
      exportedAt: new Date().toISOString(),
      cards: cards.map(
        ({
          userId: _cardUserId,
          deckId: _cardDeckId,
          id: _id,
          term,
          definition,
          paused,
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
          paused,
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
