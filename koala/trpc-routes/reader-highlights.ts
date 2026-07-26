import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import { readerBookLocatorSchema } from "@/koala/reader/book";
import type {
  ReaderHighlight,
  ReaderHighlightImportResult,
  ReaderHighlightImportSummary,
  ReaderResource,
} from "@/koala/reader/contracts";
import {
  canImportReaderHighlight,
  emptyReaderHighlightImportSummary,
  mapArticleReaderHighlight,
  mapBookReaderHighlight,
  readerHighlightLinkWhere,
  recordReaderHighlightImportResult,
  resolveReaderHighlightImportStatus,
  type ReaderHighlightImportCandidate,
} from "@/koala/reader/server-highlights";
import { procedure } from "../trpc-procedure";
import {
  requireOwnedReaderDeck,
  requireOwnedReaderResource,
  requireReaderUserId,
} from "./reader-server";

const readerResourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("article"),
    publicId: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("book"),
    publicId: z.string().trim().min(1),
  }),
]);

const readerLocationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("article"),
    occurrenceIndex: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("book"),
    locator: readerBookLocatorSchema,
    chapterTitle: z.string(),
    progression: z.number().min(0).max(1),
  }),
]);

const readerHighlightSchema = z.object({
  id: z.number().int().positive(),
  selectedText: z.string(),
  selectedOccurrenceIndex: z.number().int().min(0),
  occurrenceCount: z.number().int().min(0),
  status: z.enum(["in_progress", "ready", "error"]),
  term: z.string(),
  definition: z.string(),
  generalMeaning: z.string(),
  meaningInContext: z.string(),
  errorMessage: z.string(),
  contextBefore: z.string(),
  contextAfter: z.string(),
  importedCardId: z.number().int().nullable(),
  importedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  location: readerLocationSchema,
});

const deckSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
});

const getReaderWorkspaceInputSchema = z.object({
  resource: readerResourceSchema,
});

const getReaderWorkspaceOutputSchema = z.object({
  highlights: z.array(readerHighlightSchema),
  decks: z.array(deckSummarySchema),
});

const deleteReaderHighlightInputSchema = z.object({
  resource: readerResourceSchema,
  highlightId: z.number().int().positive(),
});

const deleteReaderHighlightOutputSchema = z.object({
  status: z.literal("deleted"),
});

const importReaderHighlightsInputSchema = z.object({
  resource: readerResourceSchema,
  deckId: z.number().int().positive(),
  highlightIds: z.array(z.number().int().positive()).min(1).max(200),
});

const readerHighlightImportStatusSchema = z.enum([
  "created",
  "duplicate",
  "already_imported",
  "not_ready",
  "missing",
]);

const readerHighlightImportSummarySchema = z.object({
  created: z.number().int().min(0),
  duplicate: z.number().int().min(0),
  alreadyImported: z.number().int().min(0),
  notReady: z.number().int().min(0),
  missing: z.number().int().min(0),
});

const importReaderHighlightsOutputSchema = z.object({
  results: z.array(
    z.object({
      highlightId: z.number().int().positive(),
      status: readerHighlightImportStatusSchema,
    }),
  ),
  summary: readerHighlightImportSummarySchema,
});

const articleHighlightSelect =
  Prisma.validator<Prisma.ReaderArticleHighlightSelect>()({
    id: true,
    selectedText: true,
    selectedOccurrenceIndex: true,
    occurrenceCount: true,
    occurrencesJson: true,
    status: true,
    term: true,
    definition: true,
    generalMeaning: true,
    meaningInContext: true,
    errorMessage: true,
    importedCardId: true,
    importedAt: true,
    createdAt: true,
    updatedAt: true,
  });

const bookHighlightSelect =
  Prisma.validator<Prisma.ReaderBookAnnotationSelect>()({
    id: true,
    quote: true,
    selectedOccurrenceIndex: true,
    occurrenceCount: true,
    status: true,
    term: true,
    definition: true,
    generalMeaning: true,
    meaningInContext: true,
    errorMessage: true,
    contextBefore: true,
    contextAfter: true,
    locatorJson: true,
    chapterTitle: true,
    progression: true,
    importedCardId: true,
    importedAt: true,
    createdAt: true,
    updatedAt: true,
  });

const importCandidateSelect = {
  id: true,
  status: true,
  term: true,
  definition: true,
  importedCardId: true,
} as const;

async function loadReaderHighlights(options: {
  resource: ReaderResource;
  resourceId: number;
  userId: string;
}): Promise<ReaderHighlight[]> {
  if (options.resource.kind === "article") {
    const highlights = await prismaClient.readerArticleHighlight.findMany({
      where: {
        articleId: options.resourceId,
        userId: options.userId,
      },
      orderBy: { createdAt: "desc" },
      select: articleHighlightSelect,
    });
    return highlights.map(mapArticleReaderHighlight);
  }

  const annotations = await prismaClient.readerBookAnnotation.findMany({
    where: {
      bookId: options.resourceId,
      userId: options.userId,
    },
    orderBy: { createdAt: "desc" },
    select: bookHighlightSelect,
  });
  return annotations.map(mapBookReaderHighlight);
}

async function deleteHighlightForResource(options: {
  resource: ReaderResource;
  resourceId: number;
  highlightId: number;
  userId: string;
}): Promise<number> {
  if (options.resource.kind === "article") {
    const deleted = await prismaClient.readerArticleHighlight.deleteMany({
      where: {
        id: options.highlightId,
        articleId: options.resourceId,
        userId: options.userId,
      },
    });
    return deleted.count;
  }

  const deleted = await prismaClient.readerBookAnnotation.deleteMany({
    where: {
      id: options.highlightId,
      bookId: options.resourceId,
      userId: options.userId,
    },
  });
  return deleted.count;
}

async function loadImportCandidates(options: {
  resource: ReaderResource;
  resourceId: number;
  highlightIds: number[];
  userId: string;
}): Promise<ReaderHighlightImportCandidate[]> {
  const where = {
    id: { in: options.highlightIds },
    userId: options.userId,
  };

  if (options.resource.kind === "article") {
    return prismaClient.readerArticleHighlight.findMany({
      where: {
        ...where,
        articleId: options.resourceId,
      },
      select: importCandidateSelect,
    });
  }

  return prismaClient.readerBookAnnotation.findMany({
    where: {
      ...where,
      bookId: options.resourceId,
    },
    select: importCandidateSelect,
  });
}

async function existingCardsByImportTerm(options: {
  highlights: ReaderHighlightImportCandidate[];
  userId: string;
}): Promise<Map<string, number>> {
  const terms = Array.from(
    new Set(
      options.highlights
        .filter(canImportReaderHighlight)
        .map((highlight) => highlight.term),
    ),
  );
  if (terms.length === 0) {
    return new Map();
  }

  const cards = await prismaClient.card.findMany({
    where: {
      userId: options.userId,
      term: { in: terms },
    },
    select: { id: true, term: true },
  });
  return new Map(cards.map((card) => [card.term, card.id]));
}

async function linkCardToHighlight(options: {
  transaction: Prisma.TransactionClient;
  resource: ReaderResource;
  resourceId: number;
  highlightId: number;
  userId: string;
  cardId: number;
}): Promise<void> {
  const data = {
    importedCardId: options.cardId,
    importedAt: new Date(),
  };
  if (options.resource.kind === "article") {
    const linked =
      await options.transaction.readerArticleHighlight.updateMany({
        where: readerHighlightLinkWhere(options),
        data,
      });
    if (linked.count !== 1) {
      throw new Error("Highlight could not be linked.");
    }
    return;
  }

  const linked = await options.transaction.readerBookAnnotation.updateMany(
    {
      where: readerHighlightLinkWhere(options),
      data,
    },
  );
  if (linked.count !== 1) {
    throw new Error("Highlight could not be linked.");
  }
}

async function createCardFromReaderHighlight(options: {
  resource: ReaderResource;
  resourceId: number;
  highlight: ReaderHighlightImportCandidate;
  deckId: number;
  userId: string;
}): Promise<number | null> {
  try {
    return await prismaClient.$transaction(async (transaction) => {
      const card = await transaction.card.create({
        data: {
          userId: options.userId,
          term: options.highlight.term,
          definition: options.highlight.definition,
          deckId: options.deckId,
          stability: 0,
          difficulty: 0,
          firstReview: 0,
          lastReview: 0,
          nextReview: 0,
          lapses: 0,
          repetitions: 0,
        },
        select: { id: true },
      });
      await linkCardToHighlight({
        transaction,
        resource: options.resource,
        resourceId: options.resourceId,
        highlightId: options.highlight.id,
        userId: options.userId,
        cardId: card.id,
      });
      return card.id;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }

    throw error;
  }
}

async function importHighlights(options: {
  resource: ReaderResource;
  resourceId: number;
  highlights: ReaderHighlightImportCandidate[];
  highlightIds: number[];
  deckId: number;
  userId: string;
}): Promise<{
  results: ReaderHighlightImportResult[];
  summary: ReaderHighlightImportSummary;
}> {
  const highlightById = new Map(
    options.highlights.map((highlight) => [highlight.id, highlight]),
  );
  const existingCardByTerm = await existingCardsByImportTerm({
    highlights: options.highlights,
    userId: options.userId,
  });
  const results: ReaderHighlightImportResult[] = [];
  const summary = emptyReaderHighlightImportSummary();

  for (const highlightId of options.highlightIds) {
    const highlight = highlightById.get(highlightId);
    const currentStatus = resolveReaderHighlightImportStatus({
      highlight,
      existingCardByTerm,
    });
    if (currentStatus) {
      recordReaderHighlightImportResult({
        summary,
        results,
        highlightId,
        status: currentStatus,
      });
      continue;
    }
    if (!highlight) {
      continue;
    }

    const cardId = await createCardFromReaderHighlight({
      resource: options.resource,
      resourceId: options.resourceId,
      highlight,
      deckId: options.deckId,
      userId: options.userId,
    });
    const status = cardId === null ? "duplicate" : "created";
    if (cardId !== null) {
      existingCardByTerm.set(highlight.term, cardId);
    }
    recordReaderHighlightImportResult({
      summary,
      results,
      highlightId,
      status,
    });
  }

  return { results, summary };
}

export const getReaderWorkspaceRoute = procedure
  .input(getReaderWorkspaceInputSchema)
  .output(getReaderWorkspaceOutputSchema)
  .query(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    const resource = await requireOwnedReaderResource({
      ...input.resource,
      userId,
    });
    const [highlights, decks] = await Promise.all([
      loadReaderHighlights({
        resource: input.resource,
        resourceId: resource.id,
        userId,
      }),
      prismaClient.deck.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return { highlights, decks };
  });

export const deleteReaderHighlightRoute = procedure
  .input(deleteReaderHighlightInputSchema)
  .output(deleteReaderHighlightOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    const resource = await requireOwnedReaderResource({
      ...input.resource,
      userId,
    });
    const deletedCount = await deleteHighlightForResource({
      resource: input.resource,
      resourceId: resource.id,
      highlightId: input.highlightId,
      userId,
    });
    if (deletedCount === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Highlight not found.",
      });
    }

    return { status: "deleted" };
  });

export const importReaderHighlightsToDeckRoute = procedure
  .input(importReaderHighlightsInputSchema)
  .output(importReaderHighlightsOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    const resource = await requireOwnedReaderResource({
      ...input.resource,
      userId,
    });
    const deckId = await requireOwnedReaderDeck({
      deckId: input.deckId,
      userId,
    });
    const highlightIds = Array.from(new Set(input.highlightIds));
    const highlights = await loadImportCandidates({
      resource: input.resource,
      resourceId: resource.id,
      highlightIds,
      userId,
    });

    return importHighlights({
      resource: input.resource,
      resourceId: resource.id,
      highlights,
      highlightIds,
      deckId,
      userId,
    });
  });
