import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import {
  chooseFurthestReaderBookLocator,
  normalizeReaderBookProgression,
  readerBookLocatorSchema,
  type ReaderBookLocator,
} from "@/koala/reader/book";
import { procedure } from "../trpc-procedure";

type ReaderBookNavigationItem = {
  label: string;
  href: string;
  children: ReaderBookNavigationItem[];
};

const readerBookNavigationItemSchema: z.ZodType<ReaderBookNavigationItem> =
  z.lazy(() =>
    z.object({
      label: z.string().trim().min(1).max(500),
      href: z.string().trim().min(1).max(1200),
      children: z.array(readerBookNavigationItemSchema),
    }),
  );

const readerBookSpineItemSchema = z
  .object({
    id: z.string().trim().max(500),
    href: z.string().trim().min(1).max(1200),
    mediaType: z.string().trim().max(200),
    title: z.string().trim().max(500).optional(),
  })
  .passthrough();

const readerBookProgressSchema = z.object({
  lastLocatorJson: readerBookLocatorSchema,
  furthestLocatorJson: readerBookLocatorSchema,
  lastOpenedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  updatedAt: z.date(),
});

const readerBookBookmarkSchema = z.object({
  id: z.number().int().positive(),
  locatorJson: readerBookLocatorSchema,
  epubCfi: z.string().nullable(),
  chapterTitle: z.string(),
  progression: z.number().min(0).max(1),
  label: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const readerBookAnnotationSchema = z.object({
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
  locatorJson: readerBookLocatorSchema,
  epubCfi: z.string().nullable(),
  chapterTitle: z.string(),
  progression: z.number().min(0).max(1),
  importedCardId: z.number().int().nullable(),
  importedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const readerBookSchema = z.object({
  id: z.number().int().positive(),
  publicId: z.string(),
  fingerprint: z.string(),
  title: z.string(),
  author: z.string(),
  description: z.string(),
  language: z.string(),
  opfIdentifier: z.string(),
  fileName: z.string(),
  fileSize: z.number().min(0),
  fileLastModified: z.number().min(0),
  coverPath: z.string(),
  targetFormat: z.string(),
  navigationJson: z.array(readerBookNavigationItemSchema),
  spineJson: z.array(readerBookSpineItemSchema),
  progress: readerBookProgressSchema.nullable(),
  bookmarkCount: z.number().int().min(0),
  annotationCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const deckSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
});

const listReaderBooksInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

const listReaderBooksOutputSchema = z.object({
  books: z.array(readerBookSchema),
});

const upsertReaderBookInputSchema = z.object({
  fingerprint: z.string().trim().min(1).max(512),
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(500).optional(),
  description: z.string().trim().max(2000).optional(),
  language: z.string().trim().max(32).optional(),
  opfIdentifier: z.string().trim().max(1000).optional(),
  fileName: z.string().trim().min(1).max(500),
  fileSize: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  fileLastModified: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  coverPath: z.string().trim().max(1200).optional(),
  targetFormat: z.literal("REFLOWABLE_EPUB").optional(),
  navigationJson: z.array(readerBookNavigationItemSchema).max(2000),
  spineJson: z.array(readerBookSpineItemSchema).min(1).max(5000),
});

const upsertReaderBookOutputSchema = z.object({
  status: z.enum(["created", "updated"]),
  book: readerBookSchema,
});

const getReaderBookInputSchema = z.object({
  publicId: z.string().trim().min(1),
});

const getReaderBookOutputSchema = z.object({
  book: readerBookSchema,
  bookmarks: z.array(readerBookBookmarkSchema),
  annotations: z.array(readerBookAnnotationSchema),
  decks: z.array(deckSummarySchema),
});

const updateReaderBookProgressInputSchema = z.object({
  publicId: z.string().trim().min(1),
  lastLocatorJson: readerBookLocatorSchema,
  furthestLocatorJson: readerBookLocatorSchema.optional(),
  completed: z.boolean().optional(),
});

const updateReaderBookProgressOutputSchema = z.object({
  status: z.literal("updated"),
  progress: readerBookProgressSchema,
});

const createReaderBookBookmarkInputSchema = z.object({
  publicId: z.string().trim().min(1),
  locatorJson: readerBookLocatorSchema,
  epubCfi: z.string().trim().max(1000).optional(),
  chapterTitle: z.string().trim().max(500).optional(),
  progression: z.number().min(0).max(1).optional(),
  label: z.string().trim().max(500).optional(),
});

const createReaderBookBookmarkOutputSchema = z.object({
  bookmark: readerBookBookmarkSchema,
});

const deleteReaderBookBookmarkInputSchema = z.object({
  publicId: z.string().trim().min(1),
  bookmarkId: z.number().int().positive(),
});

const deleteReaderBookBookmarkOutputSchema = z.object({
  status: z.literal("deleted"),
});

const listReaderBookAnnotationsInputSchema = z.object({
  publicId: z.string().trim().min(1),
});

const listReaderBookAnnotationsOutputSchema = z.object({
  annotations: z.array(readerBookAnnotationSchema),
});

const deleteReaderBookAnnotationInputSchema = z.object({
  publicId: z.string().trim().min(1),
  annotationId: z.number().int().positive(),
});

const deleteReaderBookAnnotationOutputSchema = z.object({
  status: z.literal("deleted"),
});

const importReaderBookAnnotationsToDeckInputSchema = z.object({
  publicId: z.string().trim().min(1),
  deckId: z.number().int().positive(),
  annotationIds: z.array(z.number().int().positive()).min(1).max(200),
});

const importReaderBookAnnotationResultStatusSchema = z.enum([
  "created",
  "duplicate",
  "already_imported",
  "not_ready",
  "missing",
]);

const importReaderBookAnnotationResultSchema = z.object({
  annotationId: z.number().int().positive(),
  status: importReaderBookAnnotationResultStatusSchema,
});

const importReaderBookAnnotationsToDeckOutputSchema = z.object({
  results: z.array(importReaderBookAnnotationResultSchema),
  summary: z.object({
    created: z.number().int().min(0),
    duplicate: z.number().int().min(0),
    alreadyImported: z.number().int().min(0),
    notReady: z.number().int().min(0),
    missing: z.number().int().min(0),
  }),
});

type ReaderBookWithCounts = {
  id: number;
  publicId: string;
  fingerprint: string;
  title: string;
  author: string;
  description: string;
  language: string;
  opfIdentifier: string;
  fileName: string;
  fileSize: bigint;
  fileLastModified: bigint;
  coverPath: string;
  targetFormat: string;
  navigationJson: Prisma.JsonValue;
  spineJson: Prisma.JsonValue;
  progress: ReaderBookProgressRecord | null;
  _count: {
    bookmarks: number;
    annotations: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

type ReaderBookProgressRecord = {
  lastLocatorJson: Prisma.JsonValue;
  furthestLocatorJson: Prisma.JsonValue;
  lastOpenedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
};

type ReaderBookAnnotationImportCandidate = {
  status: "IN_PROGRESS" | "READY" | "ERROR";
  term: string;
  definition: string;
  importedCardId: number | null;
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

const parseLocatorJson = (value: Prisma.JsonValue): ReaderBookLocator => {
  const parsed = readerBookLocatorSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return { href: "#" };
};

const parseNavigationJson = (
  value: Prisma.JsonValue,
): ReaderBookNavigationItem[] => {
  const parsed = z.array(readerBookNavigationItemSchema).safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return [];
};

const parseSpineJson = (
  value: Prisma.JsonValue,
): z.infer<typeof readerBookSpineItemSchema>[] => {
  const parsed = z.array(readerBookSpineItemSchema).safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return [];
};

const mapProgress = (progress: ReaderBookProgressRecord | null) => {
  if (!progress) {
    return null;
  }

  return {
    lastLocatorJson: parseLocatorJson(progress.lastLocatorJson),
    furthestLocatorJson: parseLocatorJson(progress.furthestLocatorJson),
    lastOpenedAt: progress.lastOpenedAt,
    completedAt: progress.completedAt,
    updatedAt: progress.updatedAt,
  };
};

const mapBook = (book: ReaderBookWithCounts) => {
  return {
    id: book.id,
    publicId: book.publicId,
    fingerprint: book.fingerprint,
    title: book.title,
    author: book.author,
    description: book.description,
    language: book.language,
    opfIdentifier: book.opfIdentifier,
    fileName: book.fileName,
    fileSize: Number(book.fileSize),
    fileLastModified: Number(book.fileLastModified),
    coverPath: book.coverPath,
    targetFormat: book.targetFormat,
    navigationJson: parseNavigationJson(book.navigationJson),
    spineJson: parseSpineJson(book.spineJson),
    progress: mapProgress(book.progress),
    bookmarkCount: book._count.bookmarks,
    annotationCount: book._count.annotations,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
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

const mapBookmark = (bookmark: {
  id: number;
  locatorJson: Prisma.JsonValue;
  epubCfi: string | null;
  chapterTitle: string;
  progression: number;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}) => {
  return {
    id: bookmark.id,
    locatorJson: parseLocatorJson(bookmark.locatorJson),
    epubCfi: bookmark.epubCfi,
    chapterTitle: bookmark.chapterTitle,
    progression: normalizeReaderBookProgression(bookmark.progression),
    label: bookmark.label,
    createdAt: bookmark.createdAt,
    updatedAt: bookmark.updatedAt,
  };
};

const mapAnnotation = (annotation: {
  id: number;
  quote: string;
  selectedOccurrenceIndex: number;
  occurrenceCount: number;
  status: "IN_PROGRESS" | "READY" | "ERROR";
  term: string;
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
  errorMessage: string;
  contextBefore: string;
  contextAfter: string;
  locatorJson: Prisma.JsonValue;
  epubCfi: string | null;
  chapterTitle: string;
  progression: number;
  importedCardId: number | null;
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => {
  return {
    id: annotation.id,
    selectedText: annotation.quote,
    selectedOccurrenceIndex: annotation.selectedOccurrenceIndex,
    occurrenceCount: annotation.occurrenceCount,
    status: mapHighlightStatus(annotation.status),
    term: annotation.term,
    definition: annotation.definition,
    generalMeaning: annotation.generalMeaning,
    meaningInContext: annotation.meaningInContext,
    errorMessage: annotation.errorMessage,
    contextBefore: annotation.contextBefore,
    contextAfter: annotation.contextAfter,
    locatorJson: parseLocatorJson(annotation.locatorJson),
    epubCfi: annotation.epubCfi,
    chapterTitle: annotation.chapterTitle,
    progression: normalizeReaderBookProgression(annotation.progression),
    importedCardId: annotation.importedCardId,
    importedAt: annotation.importedAt,
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
  };
};

const readerBookSelect = Prisma.validator<Prisma.ReaderBookSelect>()({
  id: true,
  publicId: true,
  fingerprint: true,
  title: true,
  author: true,
  description: true,
  language: true,
  opfIdentifier: true,
  fileName: true,
  fileSize: true,
  fileLastModified: true,
  coverPath: true,
  targetFormat: true,
  navigationJson: true,
  spineJson: true,
  progress: {
    select: {
      lastLocatorJson: true,
      furthestLocatorJson: true,
      lastOpenedAt: true,
      completedAt: true,
      updatedAt: true,
    },
  },
  _count: {
    select: {
      bookmarks: true,
      annotations: true,
    },
  },
  createdAt: true,
  updatedAt: true,
});

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function requireOwnedBook(publicId: string, userId: string) {
  const book = await prismaClient.readerBook.findUnique({
    where: { publicId },
    select: { id: true, userId: true },
  });

  if (!book) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Book not found.",
    });
  }

  if (book.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Book not owned by current user.",
    });
  }

  return book;
}

function isReadyAnnotationForImport(
  annotation: ReaderBookAnnotationImportCandidate,
): boolean {
  if (annotation.importedCardId !== null) {
    return false;
  }

  if (annotation.status !== "READY") {
    return false;
  }

  if (annotation.term.trim().length === 0) {
    return false;
  }

  return annotation.definition.trim().length > 0;
}

function recordAnnotationImportResult(
  summary: {
    created: number;
    duplicate: number;
    alreadyImported: number;
    notReady: number;
    missing: number;
  },
  results: z.infer<typeof importReaderBookAnnotationResultSchema>[],
  annotationId: number,
  status: z.infer<typeof importReaderBookAnnotationResultSchema>["status"],
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

  results.push({ annotationId, status });
}

function resolveExistingAnnotationImportStatus(options: {
  annotation:
    | (ReaderBookAnnotationImportCandidate & { id: number })
    | undefined;
  existingCardByTerm: Map<string, number>;
}): "missing" | "already_imported" | "not_ready" | "duplicate" | null {
  if (!options.annotation) {
    return "missing";
  }
  if (options.annotation.importedCardId !== null) {
    return "already_imported";
  }
  if (!isReadyAnnotationForImport(options.annotation)) {
    return "not_ready";
  }
  if (options.existingCardByTerm.has(options.annotation.term)) {
    return "duplicate";
  }
  return null;
}

async function createCardFromReaderBookAnnotation(options: {
  userId: string;
  deckId: number;
  annotationId: number;
  annotation: ReaderBookAnnotationImportCandidate & { id: number };
  existingCardByTerm: Map<string, number>;
}) {
  try {
    const card = await prismaClient.card.create({
      data: {
        userId: options.userId,
        term: options.annotation.term,
        definition: options.annotation.definition,
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

    await prismaClient.readerBookAnnotation.update({
      where: { id: options.annotationId },
      data: {
        importedCardId: card.id,
        importedAt: new Date(),
      },
    });

    options.existingCardByTerm.set(options.annotation.term, card.id);
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

function readerBookUpsertFields(
  input: z.infer<typeof upsertReaderBookInputSchema>,
) {
  return {
    fingerprint: input.fingerprint,
    title: input.title,
    author: input.author ?? "",
    description: input.description ?? "",
    language: input.language ?? "",
    opfIdentifier: input.opfIdentifier ?? "",
    fileName: input.fileName,
    fileSize: BigInt(input.fileSize),
    fileLastModified: BigInt(input.fileLastModified),
    coverPath: input.coverPath ?? "",
    targetFormat: input.targetFormat ?? "REFLOWABLE_EPUB",
    navigationJson: toPrismaJson(input.navigationJson),
    spineJson: toPrismaJson(input.spineJson),
  };
}

export const listReaderBooksRoute = procedure
  .input(listReaderBooksInputSchema)
  .output(listReaderBooksOutputSchema)
  .query(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const limit = input.limit ?? 100;

    const books = await prismaClient.readerBook.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: readerBookSelect,
    });

    return {
      books: books.map(mapBook),
    };
  });

export const upsertReaderBookRoute = procedure
  .input(upsertReaderBookInputSchema)
  .output(upsertReaderBookOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const upsertFields = readerBookUpsertFields(input);
    const existing = await prismaClient.readerBook.findUnique({
      where: {
        userId_fingerprint: {
          userId,
          fingerprint: input.fingerprint,
        },
      },
      select: { id: true },
    });

    const book = await prismaClient.readerBook.upsert({
      where: {
        userId_fingerprint: {
          userId,
          fingerprint: input.fingerprint,
        },
      },
      create: {
        userId,
        ...upsertFields,
      },
      update: upsertFields,
      select: readerBookSelect,
    });

    return {
      status: existing ? "updated" : "created",
      book: mapBook(book),
    };
  });

export const getReaderBookRoute = procedure
  .input(getReaderBookInputSchema)
  .output(getReaderBookOutputSchema)
  .query(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    const book = await prismaClient.readerBook.findUnique({
      where: { publicId: input.publicId },
      select: {
        userId: true,
        ...readerBookSelect,
      },
    });

    if (!book) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Book not found.",
      });
    }

    if (book.userId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Book not owned by current user.",
      });
    }

    const [bookmarks, annotations, decks] = await Promise.all([
      prismaClient.readerBookBookmark.findMany({
        where: { userId, bookId: book.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          locatorJson: true,
          epubCfi: true,
          chapterTitle: true,
          progression: true,
          label: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prismaClient.readerBookAnnotation.findMany({
        where: { userId, bookId: book.id },
        orderBy: { createdAt: "desc" },
        select: {
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
          epubCfi: true,
          chapterTitle: true,
          progression: true,
          importedCardId: true,
          importedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prismaClient.deck.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return {
      book: mapBook(book),
      bookmarks: bookmarks.map(mapBookmark),
      annotations: annotations.map(mapAnnotation),
      decks,
    };
  });

export const updateReaderBookProgressRoute = procedure
  .input(updateReaderBookProgressInputSchema)
  .output(updateReaderBookProgressOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const book = await requireOwnedBook(input.publicId, userId);
    const existing = await prismaClient.readerBookProgress.findUnique({
      where: { bookId: book.id },
      select: {
        lastLocatorJson: true,
        furthestLocatorJson: true,
        lastOpenedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });

    const existingFurthest = existing
      ? parseLocatorJson(existing.furthestLocatorJson)
      : null;
    const candidateFurthest =
      input.furthestLocatorJson ?? input.lastLocatorJson;
    const furthestLocatorJson = chooseFurthestReaderBookLocator({
      existing: existingFurthest,
      candidate: candidateFurthest,
    });

    const progress = await prismaClient.readerBookProgress.upsert({
      where: { bookId: book.id },
      create: {
        userId,
        bookId: book.id,
        lastLocatorJson: toPrismaJson(input.lastLocatorJson),
        furthestLocatorJson: toPrismaJson(furthestLocatorJson),
        lastOpenedAt: new Date(),
        completedAt: input.completed ? new Date() : null,
      },
      update: {
        lastLocatorJson: toPrismaJson(input.lastLocatorJson),
        furthestLocatorJson: toPrismaJson(furthestLocatorJson),
        lastOpenedAt: new Date(),
        completedAt: input.completed ? new Date() : existing?.completedAt,
      },
      select: {
        lastLocatorJson: true,
        furthestLocatorJson: true,
        lastOpenedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });

    return {
      status: "updated",
      progress: mapProgress(progress) ?? {
        lastLocatorJson: input.lastLocatorJson,
        furthestLocatorJson,
        lastOpenedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      },
    };
  });

export const createReaderBookBookmarkRoute = procedure
  .input(createReaderBookBookmarkInputSchema)
  .output(createReaderBookBookmarkOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const book = await requireOwnedBook(input.publicId, userId);
    const progression = normalizeReaderBookProgression(
      input.progression ??
        input.locatorJson.totalProgression ??
        input.locatorJson.progression ??
        0,
    );

    const bookmark = await prismaClient.readerBookBookmark.create({
      data: {
        userId,
        bookId: book.id,
        locatorJson: toPrismaJson(input.locatorJson),
        epubCfi: input.epubCfi ?? null,
        chapterTitle:
          input.chapterTitle ??
          input.locatorJson.chapterTitle ??
          input.locatorJson.title ??
          "",
        progression,
        label: input.label ?? "",
      },
      select: {
        id: true,
        locatorJson: true,
        epubCfi: true,
        chapterTitle: true,
        progression: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { bookmark: mapBookmark(bookmark) };
  });

export const deleteReaderBookBookmarkRoute = procedure
  .input(deleteReaderBookBookmarkInputSchema)
  .output(deleteReaderBookBookmarkOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const book = await requireOwnedBook(input.publicId, userId);
    const deleted = await prismaClient.readerBookBookmark.deleteMany({
      where: {
        id: input.bookmarkId,
        userId,
        bookId: book.id,
      },
    });

    if (deleted.count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Bookmark not found.",
      });
    }

    return { status: "deleted" };
  });

export const listReaderBookAnnotationsRoute = procedure
  .input(listReaderBookAnnotationsInputSchema)
  .output(listReaderBookAnnotationsOutputSchema)
  .query(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const book = await requireOwnedBook(input.publicId, userId);
    const annotations = await prismaClient.readerBookAnnotation.findMany({
      where: { userId, bookId: book.id },
      orderBy: { createdAt: "desc" },
      select: {
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
        epubCfi: true,
        chapterTitle: true,
        progression: true,
        importedCardId: true,
        importedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { annotations: annotations.map(mapAnnotation) };
  });

export const deleteReaderBookAnnotationRoute = procedure
  .input(deleteReaderBookAnnotationInputSchema)
  .output(deleteReaderBookAnnotationOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const book = await requireOwnedBook(input.publicId, userId);
    const deleted = await prismaClient.readerBookAnnotation.deleteMany({
      where: {
        id: input.annotationId,
        userId,
        bookId: book.id,
      },
    });

    if (deleted.count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Highlight not found.",
      });
    }

    return { status: "deleted" };
  });

export const importReaderBookAnnotationsToDeckRoute = procedure
  .input(importReaderBookAnnotationsToDeckInputSchema)
  .output(importReaderBookAnnotationsToDeckOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const book = await requireOwnedBook(input.publicId, userId);

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

    const uniqueAnnotationIds = Array.from(new Set(input.annotationIds));
    const annotations = await prismaClient.readerBookAnnotation.findMany({
      where: {
        id: { in: uniqueAnnotationIds },
        userId,
        bookId: book.id,
      },
      select: {
        id: true,
        status: true,
        term: true,
        definition: true,
        importedCardId: true,
      },
    });

    const annotationById = new Map(
      annotations.map((annotation) => [annotation.id, annotation]),
    );

    const readyTerms = Array.from(
      new Set(
        annotations
          .filter((annotation) => isReadyAnnotationForImport(annotation))
          .map((annotation) => annotation.term),
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

    const results: z.infer<
      typeof importReaderBookAnnotationResultSchema
    >[] = [];
    const summary = {
      created: 0,
      duplicate: 0,
      alreadyImported: 0,
      notReady: 0,
      missing: 0,
    };

    for (const annotationId of uniqueAnnotationIds) {
      const annotation = annotationById.get(annotationId);
      const existingStatus = resolveExistingAnnotationImportStatus({
        annotation,
        existingCardByTerm,
      });
      if (existingStatus) {
        recordAnnotationImportResult(
          summary,
          results,
          annotationId,
          existingStatus,
        );
        continue;
      }
      if (!annotation) {
        continue;
      }

      const createdStatus = await createCardFromReaderBookAnnotation({
        userId,
        deckId: deck.id,
        annotationId,
        annotation,
        existingCardByTerm,
      });
      recordAnnotationImportResult(
        summary,
        results,
        annotationId,
        createdStatus,
      );
    }

    return {
      results,
      summary,
    };
  });
