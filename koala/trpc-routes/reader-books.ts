import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import {
  chooseFurthestReaderBookLocator,
  readerBookLocatorSchema,
  type ReaderBookLocator,
} from "@/koala/reader/book";
import { procedure } from "../trpc-procedure";
import {
  requireOwnedReaderResource,
  requireReaderUserId,
} from "./reader-server";

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
  navigationJson: z.array(readerBookNavigationItemSchema),
  spineJson: z.array(readerBookSpineItemSchema),
  progress: readerBookProgressSchema.nullable(),
  annotationCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
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
});

const updateReaderBookProgressInputSchema = z.object({
  publicId: z.string().trim().min(1),
  lastLocatorJson: readerBookLocatorSchema,
  furthestLocatorJson: readerBookLocatorSchema.optional(),
});

const updateReaderBookProgressOutputSchema = z.object({
  status: z.literal("updated"),
  progress: readerBookProgressSchema,
});

const deleteReaderBookInputSchema = z.object({
  publicId: z.string().trim().min(1),
});

const deleteReaderBookOutputSchema = z.object({
  status: z.literal("deleted"),
});

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
  navigationJson: true,
  spineJson: true,
  progress: {
    select: {
      lastLocatorJson: true,
      furthestLocatorJson: true,
      lastOpenedAt: true,
      updatedAt: true,
    },
  },
  _count: {
    select: {
      annotations: true,
    },
  },
  createdAt: true,
  updatedAt: true,
});

type ReaderBookRecord = Prisma.ReaderBookGetPayload<{
  select: typeof readerBookSelect;
}>;

function parseLocatorJson(value: Prisma.JsonValue): ReaderBookLocator {
  const parsed = readerBookLocatorSchema.safeParse(value);
  return parsed.success ? parsed.data : { href: "#" };
}

function parseNavigationJson(
  value: Prisma.JsonValue,
): ReaderBookNavigationItem[] {
  const parsed = z.array(readerBookNavigationItemSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseSpineJson(
  value: Prisma.JsonValue,
): z.infer<typeof readerBookSpineItemSchema>[] {
  const parsed = z.array(readerBookSpineItemSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function mapBook(book: ReaderBookRecord) {
  const progress = book.progress
    ? {
        lastLocatorJson: parseLocatorJson(book.progress.lastLocatorJson),
        furthestLocatorJson: parseLocatorJson(
          book.progress.furthestLocatorJson,
        ),
        lastOpenedAt: book.progress.lastOpenedAt,
        updatedAt: book.progress.updatedAt,
      }
    : null;

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
    navigationJson: parseNavigationJson(book.navigationJson),
    spineJson: parseSpineJson(book.spineJson),
    progress,
    annotationCount: book._count.annotations,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
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
    navigationJson: toPrismaJson(input.navigationJson),
    spineJson: toPrismaJson(input.spineJson),
  };
}

export const listReaderBooksRoute = procedure
  .input(listReaderBooksInputSchema)
  .output(listReaderBooksOutputSchema)
  .query(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    const books = await prismaClient.readerBook.findMany({
      where: { userId },
      orderBy: [
        {
          progress: {
            lastOpenedAt: { sort: "desc", nulls: "last" },
          },
        },
        { updatedAt: "desc" },
      ],
      take: input.limit ?? 100,
      select: readerBookSelect,
    });

    return { books: books.map(mapBook) };
  });

export const upsertReaderBookRoute = procedure
  .input(upsertReaderBookInputSchema)
  .output(upsertReaderBookOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
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
    const userId = requireReaderUserId(ctx.user?.id);
    const ownedBook = await requireOwnedReaderResource({
      kind: "book",
      publicId: input.publicId,
      userId,
    });
    const book = await prismaClient.readerBook.findUnique({
      where: { id: ownedBook.id },
      select: readerBookSelect,
    });
    if (!book) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Book not found.",
      });
    }

    return { book: mapBook(book) };
  });

export const updateReaderBookProgressRoute = procedure
  .input(updateReaderBookProgressInputSchema)
  .output(updateReaderBookProgressOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    const book = await requireOwnedReaderResource({
      kind: "book",
      publicId: input.publicId,
      userId,
    });
    const existing = await prismaClient.readerBookProgress.findUnique({
      where: { bookId: book.id },
      select: { furthestLocatorJson: true },
    });
    const furthestLocatorJson = chooseFurthestReaderBookLocator({
      existing: existing
        ? parseLocatorJson(existing.furthestLocatorJson)
        : null,
      candidate: input.furthestLocatorJson ?? input.lastLocatorJson,
    });
    const progress = await prismaClient.readerBookProgress.upsert({
      where: { bookId: book.id },
      create: {
        userId,
        bookId: book.id,
        lastLocatorJson: toPrismaJson(input.lastLocatorJson),
        furthestLocatorJson: toPrismaJson(furthestLocatorJson),
        lastOpenedAt: new Date(),
      },
      update: {
        lastLocatorJson: toPrismaJson(input.lastLocatorJson),
        furthestLocatorJson: toPrismaJson(furthestLocatorJson),
        lastOpenedAt: new Date(),
      },
      select: {
        lastLocatorJson: true,
        furthestLocatorJson: true,
        lastOpenedAt: true,
        updatedAt: true,
      },
    });

    return {
      status: "updated",
      progress: {
        lastLocatorJson: parseLocatorJson(progress.lastLocatorJson),
        furthestLocatorJson: parseLocatorJson(
          progress.furthestLocatorJson,
        ),
        lastOpenedAt: progress.lastOpenedAt,
        updatedAt: progress.updatedAt,
      },
    };
  });

export const deleteReaderBookRoute = procedure
  .input(deleteReaderBookInputSchema)
  .output(deleteReaderBookOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    const deleted = await prismaClient.readerBook.deleteMany({
      where: {
        publicId: input.publicId,
        userId,
      },
    });
    if (deleted.count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Book not found.",
      });
    }

    return { status: "deleted" };
  });
