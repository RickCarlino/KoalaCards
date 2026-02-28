import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import {
  decryptReaderSecret,
  encryptReaderSecret,
  generateBookmarkletSecret,
  hashBookmarkletSecret,
} from "@/koala/reader/secret";
import {
  ReaderSaveError,
  queueReaderArticle,
} from "@/koala/reader/save-article";
import type {
  ReaderIngestState,
  SavedReaderArticle,
} from "@/koala/reader/save-article";
import { procedure } from "../trpc-procedure";

const readerLanguageSchema = z.enum(["ko", "en", "other"]);

const readerArticleSchema = z.object({
  id: z.number(),
  publicId: z.string(),
  title: z.string(),
  normalizedUrl: z.string(),
  description: z.string(),
  sourceLang: readerLanguageSchema,
  translated: z.boolean(),
  ingestStatus: z.enum(["pending", "in_progress", "ready", "error"]),
  ingestError: z.string(),
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

const deleteReaderArticleInputSchema = z.object({
  publicId: z.string().trim().min(1),
});

const deleteReaderArticleOutputSchema = z.object({
  status: z.literal("deleted"),
});

const mapSourceLanguage = (
  sourceLang: "KO" | "EN" | "OTHER",
): "ko" | "en" | "other" => {
  if (sourceLang === "KO") {
    return "ko";
  }

  if (sourceLang === "EN") {
    return "en";
  }

  return "other";
};

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

const mapSavedArticle = (article: SavedReaderArticle) => {
  return {
    id: article.id,
    publicId: article.publicId,
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    description: article.description,
    sourceLang: article.sourceLang,
    translated: article.translated,
    ingestStatus: article.ingestStatus,
    ingestError: article.ingestError,
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
        description: true,
        sourceLang: true,
        translated: true,
        ingestStatus: true,
        ingestError: true,
        createdAt: true,
      },
    });

    return {
      articles: articles.map((article) => ({
        id: article.id,
        publicId: article.publicId,
        title: article.title,
        normalizedUrl: article.normalizedUrl,
        description: article.description,
        sourceLang: mapSourceLanguage(article.sourceLang),
        translated: article.translated,
        ingestStatus: mapIngestStatus(article.ingestStatus),
        ingestError: article.ingestError,
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
