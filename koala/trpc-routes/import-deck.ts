import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { backfillDecks } from "../decks/backfill-decks";
import { prismaClient } from "../prisma-client";
import { storageProvider } from "../storage";
import { procedure } from "../trpc-procedure";
import { DeckExportCard, deckExportSchema } from "../types/deck-export";
import { GenderCode, normalizeGender } from "../types/gender";

type PreparedCardInput = {
  term: string;
  definition: string;
  gender: GenderCode;
  flagged: boolean;
  imageBlobId: string | null;
  stability: number;
  difficulty: number;
  firstReview: number;
  lastReview: number;
  nextReview: number;
  lapses: number;
  repetitions: number;
  lastFailure: number;
  deckId: number;
  createdAt?: Date;
};

const importDeckInput = z.object({
  deckId: z.number(),
  payload: deckExportSchema,
});

const MAX_IMPORT = 5000;

const toNumber = (value: number, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const parseDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const validatedImageBlobId = async (
  imageBlobId?: string | null,
): Promise<string | null> => {
  if (!imageBlobId) {
    return null;
  }
  try {
    const [exists] = await storageProvider.fileExists(imageBlobId);
    return exists ? imageBlobId : null;
  } catch {
    return null;
  }
};

const normalizeCard = async (
  card: DeckExportCard,
  deckId: number,
): Promise<PreparedCardInput | null> => {
  const term = card.term.trim();
  const definition = card.definition.trim();
  if (!term || !definition) {
    return null;
  }

  const imageBlobId = await validatedImageBlobId(card.imageBlobId ?? null);

  const prepared: PreparedCardInput = {
    term,
    definition,
    gender: normalizeGender(card.gender),
    flagged: Boolean(card.flagged),
    imageBlobId,
    stability: toNumber(card.stability, 0),
    difficulty: toNumber(card.difficulty, 0),
    firstReview: toNumber(card.firstReview, 0),
    lastReview: toNumber(card.lastReview, 0),
    nextReview: toNumber(card.nextReview, 0),
    lapses: toNumber(card.lapses, 0),
    repetitions: toNumber(card.repetitions, 0),
    lastFailure: toNumber(card.lastFailure, 0),
    deckId,
  };

  const createdAt = parseDate(card.createdAt);
  if (createdAt) {
    prepared.createdAt = createdAt;
  }

  return prepared;
};

export const importDeck = procedure.input(importDeckInput).mutation(
  async ({
    input,
    ctx,
  }): Promise<{
    importedCount: number;
    skippedDuplicateCount: number;
    attempted: number;
  }> => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const deck = await prismaClient.deck.findUnique({
      where: { id: input.deckId, userId },
    });

    if (!deck) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deck not found",
      });
    }

    if (input.payload.cards.length > MAX_IMPORT) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cannot import more than ${MAX_IMPORT} cards at once.`,
      });
    }

    const preparedCards = (
      await Promise.all(
        input.payload.cards.map((card) => normalizeCard(card, deck.id)),
      )
    ).filter(Boolean) as PreparedCardInput[];

    let importedCount = 0;
    let skippedDuplicateCount = 0;

    for (const card of preparedCards) {
      const duplicate = await prismaClient.card.findFirst({
        where: { userId, term: card.term },
      });

      if (duplicate) {
        skippedDuplicateCount += 1;
        continue;
      }

      await prismaClient.card.create({
        data: {
          userId,
          deckId: deck.id,
          term: card.term,
          definition: card.definition,
          gender: card.gender,
          flagged: card.flagged,
          imageBlobId: card.imageBlobId,
          stability: card.stability,
          difficulty: card.difficulty,
          firstReview: card.firstReview,
          lastReview: card.lastReview,
          nextReview: card.nextReview,
          lapses: card.lapses,
          repetitions: card.repetitions,
          lastFailure: card.lastFailure,
          ...(card.createdAt ? { createdAt: card.createdAt } : {}),
        },
      });

      importedCount += 1;
    }

    await backfillDecks(userId);

    return {
      importedCount,
      skippedDuplicateCount,
      attempted: preparedCards.length,
    };
  },
);
