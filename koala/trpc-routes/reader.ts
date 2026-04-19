import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import {
  decryptReaderSecret,
  encryptReaderSecret,
  generateBookmarkletSecret,
  hashBookmarkletSecret,
} from "@/koala/reader/secret";
import {
  refreshReaderArticle,
  ReaderSaveError,
  queueReaderArticle,
  saveReaderRawTextArticle,
} from "@/koala/reader/save-article";
import type {
  ReaderInputKindValue,
  ReaderIngestState,
  SavedReaderArticle,
} from "@/koala/reader/save-article";
import { procedure } from "../trpc-procedure";

const readerArticleSchema = z.object({
  id: z.number(),
  publicId: z.string(),
  title: z.string(),
  normalizedUrl: z.string().nullable(),
  inputKind: z.enum(["url", "raw"]),
  description: z.string(),
  ingestStatus: z.enum(["pending", "in_progress", "ready", "error"]),
  ingestError: z.string(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
});

const bookmarkletConfigSchema = z.object({
  endpointUrl: z.string().url(),
  secretKey: z.string(),
  bookmarkletScript: z.string(),
  updatedAt: z.date(),
});

const listReaderArticlesInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

const listReaderArticlesOutputSchema = z.object({
  articles: z.array(readerArticleSchema),
});

const saveReaderArticleInputSchema = z.object({
  url: z.string().trim().min(1).max(2000),
});

const saveReaderArticleOutputSchema = z.object({
  status: z.literal("queued"),
  article: readerArticleSchema,
});

const saveReaderRawTextInputSchema = z.object({
  title: z.string().trim().max(400).optional(),
  text: z.string().min(1).max(240000),
});

const saveReaderRawTextOutputSchema = z.object({
  status: z.literal("ready"),
  article: readerArticleSchema,
});

const deleteReaderArticleInputSchema = z.object({
  publicId: z.string().trim().min(1),
});

const deleteReaderArticleOutputSchema = z.object({
  status: z.literal("deleted"),
});

const refreshReaderArticleInputSchema = z.object({
  publicId: z.string().trim().min(1),
});

const refreshReaderArticleOutputSchema = z.object({
  status: z.enum(["queued", "noop"]),
  article: readerArticleSchema,
});

const setReaderArticleReadStateInputSchema = z.object({
  publicId: z.string().trim().min(1),
  read: z.boolean(),
});

const setReaderArticleReadStateOutputSchema = z.object({
  status: z.literal("updated"),
  article: readerArticleSchema,
});

const listReaderArticleHighlightsInputSchema = z.object({
  publicId: z.string().trim().min(1),
});

const deleteReaderArticleHighlightInputSchema = z.object({
  publicId: z.string().trim().min(1),
  highlightId: z.number().int().positive(),
});

const deleteReaderArticleHighlightOutputSchema = z.object({
  status: z.literal("deleted"),
});

const importReaderHighlightsToDeckInputSchema = z.object({
  publicId: z.string().trim().min(1),
  deckId: z.number().int().positive(),
  highlightIds: z.array(z.number().int().positive()).min(1).max(200),
});

const importReaderHighlightResultStatusSchema = z.enum([
  "created",
  "duplicate",
  "already_imported",
  "not_ready",
  "missing",
]);

const importReaderHighlightResultSchema = z.object({
  highlightId: z.number().int().positive(),
  status: importReaderHighlightResultStatusSchema,
});

const importReaderHighlightsToDeckOutputSchema = z.object({
  results: z.array(importReaderHighlightResultSchema),
  summary: z.object({
    created: z.number().int().min(0),
    duplicate: z.number().int().min(0),
    alreadyImported: z.number().int().min(0),
    notReady: z.number().int().min(0),
    missing: z.number().int().min(0),
  }),
});

const readerHighlightOccurrenceSchema = z.object({
  index: z.number().int().min(0),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  before: z.string(),
  match: z.string(),
  after: z.string(),
});

const readerArticleHighlightSchema = z.object({
  id: z.number().int(),
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
});

const listReaderArticleHighlightsOutputSchema = z.object({
  highlights: z.array(readerArticleHighlightSchema),
});

const mapIngestStatus = (
  status: "PENDING" | "IN_PROGRESS" | "READY" | "ERROR",
): ReaderIngestState => {
  if (status === "PENDING") {
    return "pending";
  }

  if (status === "IN_PROGRESS") {
    return "in_progress";
  }

  if (status === "READY") {
    return "ready";
  }

  return "error";
};

const mapInputKind = (inputKind: "URL" | "RAW"): ReaderInputKindValue => {
  if (inputKind === "RAW") {
    return "raw";
  }

  return "url";
};

const mapHighlightStatus = (
  status: "IN_PROGRESS" | "READY" | "ERROR",
): "in_progress" | "ready" | "error" => {
  if (status === "IN_PROGRESS") {
    return "in_progress";
  }

  if (status === "READY") {
    return "ready";
  }

  return "error";
};

const parseHighlightOccurrences = (
  value: unknown,
): z.infer<typeof readerHighlightOccurrenceSchema>[] => {
  const parsed = z.array(readerHighlightOccurrenceSchema).safeParse(value);
  if (!parsed.success) {
    return [];
  }

  return parsed.data;
};

type ReaderHighlightImportCandidate = {
  status: "IN_PROGRESS" | "READY" | "ERROR";
  term: string;
  definition: string;
  importedCardId: number | null;
};

function isReadyHighlightForImport(
  highlight: ReaderHighlightImportCandidate,
): boolean {
  if (highlight.importedCardId !== null) {
    return false;
  }

  if (highlight.status !== "READY") {
    return false;
  }

  if (highlight.term.trim().length === 0) {
    return false;
  }

  return highlight.definition.trim().length > 0;
}

const mapSavedArticle = (article: SavedReaderArticle) => {
  return {
    id: article.id,
    publicId: article.publicId,
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    inputKind: article.inputKind,
    description: article.description,
    ingestStatus: article.ingestStatus,
    ingestError: article.ingestError,
    readAt: article.readAt,
    createdAt: article.createdAt,
  };
};

const requireUserId = (userId?: string): string => {
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not authenticated.",
    });
  }

  return userId;
};

const appBaseUrl = (): string => {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

const bookmarkletEndpointUrl = (): string => {
  return `${appBaseUrl()}/api/reader/bookmarklet`;
};

const bookmarkletScriptFor = (secretKey: string): string => {
  const endpoint = bookmarkletEndpointUrl();
  const encodedEndpoint = encodeURIComponent(endpoint);
  const encodedKey = encodeURIComponent(secretKey);

  return [
    "javascript:(()=>{",
    `const endpoint=decodeURIComponent('${encodedEndpoint}');`,
    `const key=decodeURIComponent('${encodedKey}');`,
    "const url=encodeURIComponent(location.href);",
    "const title=encodeURIComponent(document.title||'');",
    "const target=`${endpoint}?key=${encodeURIComponent(key)}&url=${url}&title=${title}`;",
    "window.open(target,'_blank','noopener,noreferrer');",
    "})();",
  ].join("");
};

const saveCredentialForUser = async (
  userId: string,
  secretKey: string,
): Promise<Date> => {
  const record = await prismaClient.readerBookmarkletCredential.upsert({
    where: { userId },
    create: {
      userId,
      secretHash: hashBookmarkletSecret(secretKey),
      encryptedSecret: encryptReaderSecret(secretKey),
    },
    update: {
      secretHash: hashBookmarkletSecret(secretKey),
      encryptedSecret: encryptReaderSecret(secretKey),
    },
    select: {
      updatedAt: true,
    },
  });

  return record.updatedAt;
};

const readOrCreateCredential = async (
  userId: string,
): Promise<{ secretKey: string; updatedAt: Date }> => {
  const existing =
    await prismaClient.readerBookmarkletCredential.findUnique({
      where: { userId },
      select: {
        encryptedSecret: true,
        updatedAt: true,
      },
    });

  if (!existing) {
    const secretKey = generateBookmarkletSecret();
    const updatedAt = await saveCredentialForUser(userId, secretKey);
    return { secretKey, updatedAt };
  }

  try {
    return {
      secretKey: decryptReaderSecret(existing.encryptedSecret),
      updatedAt: existing.updatedAt,
    };
  } catch {
    const secretKey = generateBookmarkletSecret();
    const updatedAt = await saveCredentialForUser(userId, secretKey);
    return { secretKey, updatedAt };
  }
};

const mapSaveError = (error: unknown): never => {
  if (error instanceof ReaderSaveError) {
    if (error.code === "BAD_REQUEST") {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }

    if (error.code === "FORBIDDEN") {
      throw new TRPCError({ code: "FORBIDDEN", message: error.message });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  const message =
    error instanceof Error ? error.message : "Unexpected reader error.";

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
  });
};

export const getReaderBookmarkletConfig = procedure
  .input(z.object({}))
  .output(bookmarkletConfigSchema)
  .query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const { secretKey, updatedAt } = await readOrCreateCredential(userId);

    return {
      endpointUrl: bookmarkletEndpointUrl(),
      secretKey,
      bookmarkletScript: bookmarkletScriptFor(secretKey),
      updatedAt,
    };
  });

export const rotateReaderBookmarkletKey = procedure
  .input(z.object({}))
  .output(bookmarkletConfigSchema)
  .mutation(async ({ ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const secretKey = generateBookmarkletSecret();
    const updatedAt = await saveCredentialForUser(userId, secretKey);

    return {
      endpointUrl: bookmarkletEndpointUrl(),
      secretKey,
      bookmarkletScript: bookmarkletScriptFor(secretKey),
      updatedAt,
    };
  });

export const saveReaderArticleRoute = procedure
  .input(saveReaderArticleInputSchema)
  .output(saveReaderArticleOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    try {
      const article = await queueReaderArticle({
        userId,
        requestUrl: input.url,
        saveOrigin: "DASHBOARD",
      });

      return {
        status: "queued",
        article: mapSavedArticle(article),
      };
    } catch (error) {
      return mapSaveError(error);
    }
  });

export const saveReaderRawTextRoute = procedure
  .input(saveReaderRawTextInputSchema)
  .output(saveReaderRawTextOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    try {
      const article = await saveReaderRawTextArticle({
        userId,
        title: input.title,
        text: input.text,
      });

      return {
        status: "ready",
        article: mapSavedArticle(article),
      };
    } catch (error) {
      return mapSaveError(error);
    }
  });

export const listReaderArticlesRoute = procedure
  .input(listReaderArticlesInputSchema)
  .output(listReaderArticlesOutputSchema)
  .query(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const limit = input.limit ?? 100;

    const articles = await prismaClient.readerArticle.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        publicId: true,
        title: true,
        normalizedUrl: true,
        inputKind: true,
        description: true,
        ingestStatus: true,
        ingestError: true,
        readAt: true,
        createdAt: true,
      },
    });

    return {
      articles: articles.map((article) => ({
        id: article.id,
        publicId: article.publicId,
        title: article.title,
        normalizedUrl: article.normalizedUrl,
        inputKind: mapInputKind(article.inputKind),
        description: article.description,
        ingestStatus: mapIngestStatus(article.ingestStatus),
        ingestError: article.ingestError,
        readAt: article.readAt,
        createdAt: article.createdAt,
      })),
    };
  });

export const deleteReaderArticleRoute = procedure
  .input(deleteReaderArticleInputSchema)
  .output(deleteReaderArticleOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    const deleted = await prismaClient.readerArticle.deleteMany({
      where: {
        userId,
        publicId: input.publicId,
      },
    });

    if (deleted.count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Article not found.",
      });
    }

    return { status: "deleted" };
  });

export const refreshReaderArticleRoute = procedure
  .input(refreshReaderArticleInputSchema)
  .output(refreshReaderArticleOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    try {
      const article = await refreshReaderArticle({
        userId,
        publicId: input.publicId,
      });

      return {
        status: article.inputKind === "raw" ? "noop" : "queued",
        article: mapSavedArticle(article),
      };
    } catch (error) {
      return mapSaveError(error);
    }
  });

export const setReaderArticleReadStateRoute = procedure
  .input(setReaderArticleReadStateInputSchema)
  .output(setReaderArticleReadStateOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    const article = await prismaClient.readerArticle.findUnique({
      where: { publicId: input.publicId },
      select: { id: true, userId: true },
    });

    if (!article) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Article not found.",
      });
    }

    if (article.userId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Article not owned by current user.",
      });
    }

    const updated = await prismaClient.readerArticle.update({
      where: { id: article.id },
      data: {
        readAt: input.read ? new Date() : null,
      },
      select: {
        id: true,
        publicId: true,
        title: true,
        normalizedUrl: true,
        inputKind: true,
        description: true,
        ingestStatus: true,
        ingestError: true,
        readAt: true,
        createdAt: true,
      },
    });

    return {
      status: "updated",
      article: {
        id: updated.id,
        publicId: updated.publicId,
        title: updated.title,
        normalizedUrl: updated.normalizedUrl,
        inputKind: mapInputKind(updated.inputKind),
        description: updated.description,
        ingestStatus: mapIngestStatus(updated.ingestStatus),
        ingestError: updated.ingestError,
        readAt: updated.readAt,
        createdAt: updated.createdAt,
      },
    };
  });

export const listReaderArticleHighlightsRoute = procedure
  .input(listReaderArticleHighlightsInputSchema)
  .output(listReaderArticleHighlightsOutputSchema)
  .query(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    const article = await prismaClient.readerArticle.findUnique({
      where: { publicId: input.publicId },
      select: { id: true, userId: true },
    });

    if (!article) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Article not found.",
      });
    }

    if (article.userId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Article not owned by current user.",
      });
    }

    const highlights = await prismaClient.readerArticleHighlight.findMany({
      where: {
        userId,
        articleId: article.id,
      },
      orderBy: { createdAt: "desc" },
      select: {
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
      },
    });

    return {
      highlights: highlights.map((highlight) => {
        const occurrences = parseHighlightOccurrences(
          highlight.occurrencesJson,
        );
        const currentOccurrence =
          occurrences[highlight.selectedOccurrenceIndex] ?? null;

        return {
          id: highlight.id,
          selectedText: highlight.selectedText,
          selectedOccurrenceIndex: highlight.selectedOccurrenceIndex,
          occurrenceCount: highlight.occurrenceCount,
          status: mapHighlightStatus(highlight.status),
          term: highlight.term,
          definition: highlight.definition,
          generalMeaning: highlight.generalMeaning,
          meaningInContext: highlight.meaningInContext,
          errorMessage: highlight.errorMessage,
          contextBefore: currentOccurrence?.before ?? "",
          contextAfter: currentOccurrence?.after ?? "",
          importedCardId: highlight.importedCardId,
          importedAt: highlight.importedAt,
          createdAt: highlight.createdAt,
          updatedAt: highlight.updatedAt,
        };
      }),
    };
  });

function recordHighlightImportResult(
  summary: {
    created: number;
    duplicate: number;
    alreadyImported: number;
    notReady: number;
    missing: number;
  },
  results: z.infer<typeof importReaderHighlightResultSchema>[],
  highlightId: number,
  status: z.infer<typeof importReaderHighlightResultSchema>["status"],
) {
  if (status === "created") {
    summary.created += 1;
  }
  if (status === "duplicate") {
    summary.duplicate += 1;
  }
  if (status === "already_imported") {
    summary.alreadyImported += 1;
  }
  if (status === "not_ready") {
    summary.notReady += 1;
  }
  if (status === "missing") {
    summary.missing += 1;
  }

  results.push({ highlightId, status });
}

function resolveExistingHighlightImportStatus(options: {
  highlight: (ReaderHighlightImportCandidate & { id: number }) | undefined;
  existingCardByTerm: Map<string, number>;
}): "missing" | "already_imported" | "not_ready" | "duplicate" | null {
  if (!options.highlight) {
    return "missing";
  }
  if (options.highlight.importedCardId !== null) {
    return "already_imported";
  }
  if (!isReadyHighlightForImport(options.highlight)) {
    return "not_ready";
  }
  if (options.existingCardByTerm.has(options.highlight.term)) {
    return "duplicate";
  }
  return null;
}

async function createCardFromReaderHighlight(options: {
  userId: string;
  deckId: number;
  highlightId: number;
  highlight: ReaderHighlightImportCandidate & { id: number };
  existingCardByTerm: Map<string, number>;
}) {
  try {
    const card = await prismaClient.card.create({
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

    await prismaClient.readerArticleHighlight.update({
      where: { id: options.highlightId },
      data: {
        importedCardId: card.id,
        importedAt: new Date(),
      },
    });

    options.existingCardByTerm.set(options.highlight.term, card.id);
    return "created" as const;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "duplicate" as const;
    }

    throw error;
  }
}

export const importReaderHighlightsToDeckRoute = procedure
  .input(importReaderHighlightsToDeckInputSchema)
  .output(importReaderHighlightsToDeckOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    const article = await prismaClient.readerArticle.findUnique({
      where: { publicId: input.publicId },
      select: { id: true, userId: true },
    });

    if (!article) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Article not found.",
      });
    }

    if (article.userId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Article not owned by current user.",
      });
    }

    const deck = await prismaClient.deck.findUnique({
      where: {
        id: input.deckId,
        userId,
      },
      select: { id: true },
    });

    if (!deck) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deck not found.",
      });
    }

    const uniqueHighlightIds = Array.from(new Set(input.highlightIds));
    const highlights = await prismaClient.readerArticleHighlight.findMany({
      where: {
        id: { in: uniqueHighlightIds },
        userId,
        articleId: article.id,
      },
      select: {
        id: true,
        status: true,
        term: true,
        definition: true,
        importedCardId: true,
      },
    });

    const highlightById = new Map(
      highlights.map((highlight) => [highlight.id, highlight]),
    );

    const readyTerms = Array.from(
      new Set(
        highlights
          .filter((highlight) => isReadyHighlightForImport(highlight))
          .map((highlight) => highlight.term),
      ),
    );

    const existingCards =
      readyTerms.length > 0
        ? await prismaClient.card.findMany({
            where: {
              userId,
              term: { in: readyTerms },
            },
            select: { id: true, term: true },
          })
        : [];

    const existingCardByTerm = new Map(
      existingCards.map((card) => [card.term, card.id]),
    );

    const results: z.infer<typeof importReaderHighlightResultSchema>[] =
      [];
    const summary = {
      created: 0,
      duplicate: 0,
      alreadyImported: 0,
      notReady: 0,
      missing: 0,
    };

    for (const highlightId of uniqueHighlightIds) {
      const highlight = highlightById.get(highlightId);
      const existingStatus = resolveExistingHighlightImportStatus({
        highlight,
        existingCardByTerm,
      });
      if (existingStatus) {
        recordHighlightImportResult(
          summary,
          results,
          highlightId,
          existingStatus,
        );
        continue;
      }
      if (!highlight) {
        continue;
      }

      const createdStatus = await createCardFromReaderHighlight({
        userId,
        deckId: deck.id,
        highlightId,
        highlight,
        existingCardByTerm,
      });
      recordHighlightImportResult(
        summary,
        results,
        highlightId,
        createdStatus,
      );
    }

    return {
      results,
      summary,
    };
  });

export const deleteReaderArticleHighlightRoute = procedure
  .input(deleteReaderArticleHighlightInputSchema)
  .output(deleteReaderArticleHighlightOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    const article = await prismaClient.readerArticle.findUnique({
      where: { publicId: input.publicId },
      select: { id: true, userId: true },
    });

    if (!article) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Article not found.",
      });
    }

    if (article.userId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Article not owned by current user.",
      });
    }

    const deletedHighlight =
      await prismaClient.readerArticleHighlight.deleteMany({
        where: {
          id: input.highlightId,
          userId,
          articleId: article.id,
        },
      });

    if (deletedHighlight.count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Highlight not found.",
      });
    }

    return { status: "deleted" };
  });
