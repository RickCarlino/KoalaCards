import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import {
  queueReaderArticle,
  ReaderSaveError,
  saveReaderRawTextArticle,
  type ReaderIngestState,
  type ReaderInputKindValue,
  type SavedReaderArticle,
} from "@/koala/reader/save-article";
import { procedure } from "../trpc-procedure";
import {
  requireOwnedReaderResource,
  requireReaderUserId,
} from "./reader-server";

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
  highlightCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const readerArticleListSelect =
  Prisma.validator<Prisma.ReaderArticleSelect>()({
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
    updatedAt: true,
    _count: {
      select: {
        highlights: true,
      },
    },
  });

type ReaderArticleListRecord = Prisma.ReaderArticleGetPayload<{
  select: typeof readerArticleListSelect;
}>;

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

const setReaderArticleReadStateInputSchema = z.object({
  publicId: z.string().trim().min(1),
  read: z.boolean(),
});

const setReaderArticleReadStateOutputSchema = z.object({
  status: z.literal("updated"),
  article: readerArticleSchema,
});

function mapIngestStatus(
  status: "PENDING" | "IN_PROGRESS" | "READY" | "ERROR",
): ReaderIngestState {
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
}

function mapInputKind(inputKind: "URL" | "RAW"): ReaderInputKindValue {
  return inputKind === "RAW" ? "raw" : "url";
}

function mapReaderArticleListRecord(article: ReaderArticleListRecord) {
  return {
    id: article.id,
    publicId: article.publicId,
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    inputKind: mapInputKind(article.inputKind),
    description: article.description,
    ingestStatus: mapIngestStatus(article.ingestStatus),
    ingestError: article.ingestError,
    readAt: article.readAt,
    highlightCount: article._count.highlights,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

function mapSavedArticle(article: SavedReaderArticle) {
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
    highlightCount: 0,
    createdAt: article.createdAt,
    updatedAt: article.createdAt,
  };
}

function mapSaveError(error: unknown): never {
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

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message:
      error instanceof Error ? error.message : "Unexpected reader error.",
  });
}

export const saveReaderArticleRoute = procedure
  .input(saveReaderArticleInputSchema)
  .output(saveReaderArticleOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    try {
      const article = await queueReaderArticle({
        userId,
        requestUrl: input.url,
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
    const userId = requireReaderUserId(ctx.user?.id);
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
    const userId = requireReaderUserId(ctx.user?.id);
    const articles = await prismaClient.readerArticle.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 100,
      select: readerArticleListSelect,
    });

    return {
      articles: articles.map(mapReaderArticleListRecord),
    };
  });

export const deleteReaderArticleRoute = procedure
  .input(deleteReaderArticleInputSchema)
  .output(deleteReaderArticleOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
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

export const setReaderArticleReadStateRoute = procedure
  .input(setReaderArticleReadStateInputSchema)
  .output(setReaderArticleReadStateOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireReaderUserId(ctx.user?.id);
    const article = await requireOwnedReaderResource({
      kind: "article",
      publicId: input.publicId,
      userId,
    });
    const updated = await prismaClient.readerArticle.update({
      where: { id: article.id },
      data: {
        readAt: input.read ? new Date() : null,
      },
      select: readerArticleListSelect,
    });

    return {
      status: "updated",
      article: mapReaderArticleListRecord(updated),
    };
  });
