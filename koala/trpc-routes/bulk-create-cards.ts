import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { LANG_CODES } from "../shared-types";
import { TRPCError } from "@trpc/server";
import { maybeAddImageToCard } from "../image";
import { ensureDeckFsrsConfig } from "../fsrs/scheduler";

const inputSchema = z.object({
  deckId: z.number().optional(),
  langCode: LANG_CODES.optional(),
  deckName: z.string().optional(),
  input: z
    .array(
      z.object({
        term: z.string().max(200),
        definition: z.string().max(200),
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

function requireBulkCreateUserId(userId: string | undefined): string {
  if (userId) {
    return userId;
  }

  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "User not found",
  });
}

async function resolveBulkCreateDeck(options: {
  userId: string;
  deckId?: number;
  deckName?: string;
}) {
  const existingDeck =
    options.deckId &&
    (await prismaClient.deck.findUnique({
      where: { id: options.deckId, userId: options.userId },
    }));
  if (existingDeck) {
    return existingDeck;
  }

  if (!options.deckName) {
    return null;
  }

  return (
    (await prismaClient.deck.findFirst({
      where: { userId: options.userId, name: options.deckName },
    })) ??
    (await prismaClient.deck.create({
      data: { userId: options.userId, name: options.deckName },
    }))
  );
}

function throwMissingDeckError(deckId?: number): never {
  throw new TRPCError({
    code: deckId ? "NOT_FOUND" : "BAD_REQUEST",
    message: deckId
      ? `Deck with ID ${deckId} not found or access denied.`
      : "Input must include either 'deckId' or 'deckName'.",
  });
}

function duplicateResult(term: string, definition: string) {
  const prefix = "(Duplicate) ";
  return {
    term: prefix + term,
    definition: prefix + definition,
  };
}

export const bulkCreateCards = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireBulkCreateUserId(ctx.user?.id);

    const results: { term: string; definition: string }[] = [];
    const { deckId: inDeckId, deckName } = input;
    const deck = await resolveBulkCreateDeck({
      userId,
      deckId: inDeckId,
      deckName,
    });

    if (!deck) {
      throwMissingDeckError(inDeckId);
    }

    const { id: deckId } = deck;
    await ensureDeckFsrsConfig(prismaClient, { userId, deckId });
    let processed = 0;

    for (const { term, definition } of input.input) {
      const duplicate = await prismaClient.card.findFirst({
        where: { userId, term },
      });

      if (duplicate) {
        results.push(duplicateResult(term, definition));
        continue;
      }

      const card = await prismaClient.card.create({
        data: {
          userId,
          term,
          definition,
          deckId,
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

    return results;
  });
