import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { TRPCError } from "@trpc/server";
import { ensureDeckFsrsConfig } from "../fsrs/scheduler";
import { REVIEW_LOG_COVERAGE_PARTIAL } from "../fsrs/constants";

export const mergeDecks = procedure
  .input(
    z.object({
      deckIds: z.array(z.number()).min(2),
      newDeckName: z.string().min(1),
    }),
  )
  .output(
    z.object({
      newDeckId: z.number(),
      cardsUpdated: z.number(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userSettings = await getUserSettings(ctx.user?.id);
    const userId = userSettings.user.id;

    const decks = await prismaClient.deck.findMany({
      where: {
        id: { in: input.deckIds },
        userId,
      },
    });

    if (decks.length !== input.deckIds.length) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "You don't have access to one or more of the selected decks",
      });
    }

    const sourceDeck = decks.find((deck) => deck.id === input.deckIds[0]);
    if (!sourceDeck) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Could not resolve source deck for merge.",
      });
    }

    const result = await prismaClient.$transaction(async (tx) => {
      const newDeck = await tx.deck.create({
        data: {
          name: input.newDeckName,
          description: sourceDeck.description,
          userId,
        },
      });
      await ensureDeckFsrsConfig(tx, { userId, deckId: newDeck.id });

      await tx.writingSubmission.updateMany({
        where: {
          userId,
          deckId: { in: input.deckIds },
        },
        data: {
          deckId: newDeck.id,
        },
      });

      const reviewedUpdateResult = await tx.card.updateMany({
        where: {
          userId,
          deckId: { in: input.deckIds },
          OR: [
            { firstReview: { gt: 0 } },
            { lastReview: { gt: 0 } },
            { repetitions: { gt: 0 } },
            { lapses: { gt: 0 } },
          ],
        },
        data: {
          deckId: newDeck.id,
          reviewLogCoverage: REVIEW_LOG_COVERAGE_PARTIAL,
          reviewLogStartedAt: null,
        },
      });

      const unreviewedUpdateResult = await tx.card.updateMany({
        where: {
          userId,
          deckId: { in: input.deckIds },
        },
        data: {
          deckId: newDeck.id,
        },
      });

      const sourceDecksWithReviewLogs = await tx.cardReviewLog.findMany({
        where: {
          userId,
          deckId: { in: input.deckIds },
        },
        distinct: ["deckId"],
        select: { deckId: true },
      });
      const sourceDeckIdsWithReviewLogs = new Set(
        sourceDecksWithReviewLogs.map((log) => log.deckId),
      );
      const deletableSourceDeckIds = input.deckIds.filter(
        (deckId) => !sourceDeckIdsWithReviewLogs.has(deckId),
      );

      await tx.deck.deleteMany({
        where: {
          id: { in: deletableSourceDeckIds },
          userId,
        },
      });

      return {
        newDeckId: newDeck.id,
        cardsUpdated:
          reviewedUpdateResult.count + unreviewedUpdateResult.count,
      };
    });

    return result;
  });
