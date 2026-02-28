import { ReaderIngestStatus, ReaderSourceLanguage } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import {
  InstapaperApiError,
  InstapaperSession,
  addPrivateInstapaperBookmark,
  archiveInstapaperBookmark,
  createInstapaperSession,
  listInstapaperUnreadBookmarks,
} from "@/koala/reader/instapaper";
import {
  ReaderSaveError,
  queueReaderArticle,
} from "@/koala/reader/save-article";
import {
  normalizeSourceUrl,
  plainTextToHtmlParagraphs,
} from "@/koala/reader/article";
import {
  decryptReaderSecret,
  encryptReaderSecret,
} from "@/koala/reader/secret";
import { procedure } from "../trpc-procedure";

const readerIngestStatusSchema = z.enum([
  "pending",
  "in_progress",
  "ready",
  "error",
]);
const readerLanguageSchema = z.enum(["ko", "en", "other"]);

const instapaperConnectionSchema = z.object({
  connected: z.boolean(),
  username: z.string().nullable(),
  updatedAt: z.date().nullable(),
});

const connectInstapaperInputSchema = z.object({
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
});

const disconnectInstapaperOutputSchema = z.object({
  status: z.literal("disconnected"),
});

const localReaderArticleSchema = z.object({
  publicId: z.string(),
  title: z.string(),
  ingestStatus: readerIngestStatusSchema,
  sourceLang: readerLanguageSchema,
  translated: z.boolean(),
  createdAt: z.date(),
  instapaperBookmarkId: z.string().nullable(),
});

const unreadBookmarkSchema = z.object({
  bookmarkId: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string(),
  normalizedUrl: z.string().nullable(),
  urlError: z.string().nullable(),
  localArticle: localReaderArticleSchema.nullable(),
});

const listUnreadInputSchema = z.object({});
const listUnreadOutputSchema = z.object({
  bookmarks: z.array(unreadBookmarkSchema),
});

const importUnreadInputSchema = z.object({});
const importUnreadOutputSchema = z.object({
  summary: z.object({
    imported: z.number().int().min(0),
    duplicates: z.number().int().min(0),
    invalidUrls: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),
  errors: z.array(z.string()),
  bookmarks: z.array(unreadBookmarkSchema),
});

const exportArticleInputSchema = z.object({
  publicId: z.string().trim().min(1),
  archiveOriginal: z.boolean().default(true),
  originalBookmarkId: z.string().trim().optional(),
});

const exportArticleOutputSchema = z.object({
  status: z.enum([
    "exported",
    "exported_and_archived",
    "exported_archive_failed",
  ]),
  exportedBookmarkId: z.string().nullable(),
  archivedOriginal: z.boolean(),
  archiveError: z.string().nullable(),
});

type ReaderInstapaperCredentialRecord = {
  id: number;
  instapaperUsername: string;
  encryptedAccessToken: string;
  encryptedAccessSecret: string;
  updatedAt: Date;
};

type LocalReaderArticleRecord = {
  id: number;
  publicId: string;
  title: string;
  normalizedUrl: string;
  ingestStatus: ReaderIngestStatus;
  sourceLang: ReaderSourceLanguage;
  translated: boolean;
  createdAt: Date;
  instapaperBookmarkId: string | null;
};

type UnreadBookmarkItem = {
  bookmarkId: string;
  url: string;
  title: string;
  description: string;
  normalizedUrl: string | null;
  urlError: string | null;
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

const mapIngestStatus = (
  status: ReaderIngestStatus,
): "pending" | "in_progress" | "ready" | "error" => {
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

const mapSourceLanguage = (
  sourceLang: ReaderSourceLanguage,
): "ko" | "en" | "other" => {
  if (sourceLang === "KO") {
    return "ko";
  }

  if (sourceLang === "EN") {
    return "en";
  }

  return "other";
};

const isIgnoredInstapaperUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol.toLowerCase() === "instapaper:";
  } catch {
    return false;
  }
};

const normalizeInstapaperItem = (item: {
  bookmarkId: string;
  url: string;
  title: string;
  description: string;
}): UnreadBookmarkItem => {
  const trimmedUrl = item.url.trim();

  if (!trimmedUrl) {
    return {
      bookmarkId: item.bookmarkId,
      url: item.url,
      title: item.title,
      description: item.description,
      normalizedUrl: null,
      urlError: "Bookmark URL is empty.",
    };
  }

  try {
    return {
      bookmarkId: item.bookmarkId,
      url: item.url,
      title: item.title,
      description: item.description,
      normalizedUrl: normalizeSourceUrl(trimmedUrl),
      urlError: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not parse this Instapaper bookmark URL.";

    return {
      bookmarkId: item.bookmarkId,
      url: item.url,
      title: item.title,
      description: item.description,
      normalizedUrl: null,
      urlError: message,
    };
  }
};

const ingestPriority = (status: ReaderIngestStatus): number => {
  if (status === "READY") {
    return 4;
  }

  if (status === "IN_PROGRESS") {
    return 3;
  }

  if (status === "PENDING") {
    return 2;
  }

  return 1;
};

const isBetterArticleCandidate = (
  candidate: LocalReaderArticleRecord,
  current: LocalReaderArticleRecord,
): boolean => {
  const candidatePriority = ingestPriority(candidate.ingestStatus);
  const currentPriority = ingestPriority(current.ingestStatus);

  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority;
  }

  return candidate.createdAt.getTime() > current.createdAt.getTime();
};

const pickPreferredArticle = (
  articles: LocalReaderArticleRecord[],
): LocalReaderArticleRecord => {
  let preferred = articles[0];

  for (const article of articles.slice(1)) {
    if (isBetterArticleCandidate(article, preferred)) {
      preferred = article;
    }
  }

  return preferred;
};

const listArticlesByNormalizedUrl = async (
  userId: string,
  normalizedUrls: string[],
): Promise<Map<string, LocalReaderArticleRecord>> => {
  if (normalizedUrls.length === 0) {
    return new Map();
  }

  const records = await prismaClient.readerArticle.findMany({
    where: {
      userId,
      normalizedUrl: {
        in: normalizedUrls,
      },
    },
    select: {
      id: true,
      publicId: true,
      title: true,
      normalizedUrl: true,
      ingestStatus: true,
      sourceLang: true,
      translated: true,
      createdAt: true,
      instapaperBookmarkId: true,
    },
  });

  const grouped = new Map<string, LocalReaderArticleRecord[]>();

  for (const record of records) {
    const existing = grouped.get(record.normalizedUrl) ?? [];
    existing.push(record);
    grouped.set(record.normalizedUrl, existing);
  }

  const mapped = new Map<string, LocalReaderArticleRecord>();

  for (const [normalizedUrl, articles] of grouped) {
    mapped.set(normalizedUrl, pickPreferredArticle(articles));
  }

  return mapped;
};

const normalizeUnreadBookmarks = (
  unread: Array<{
    bookmarkId: string;
    url: string;
    title: string;
    description: string;
  }>,
): UnreadBookmarkItem[] => {
  return unread
    .filter((bookmark) => !isIgnoredInstapaperUrl(bookmark.url))
    .map((bookmark) => normalizeInstapaperItem(bookmark));
};

const toUniqueNormalizedUrls = (
  bookmarks: UnreadBookmarkItem[],
): string[] => {
  const unique = new Set<string>();

  for (const bookmark of bookmarks) {
    if (bookmark.normalizedUrl) {
      unique.add(bookmark.normalizedUrl);
    }
  }

  return Array.from(unique);
};

const mapLocalReaderArticle = (record: LocalReaderArticleRecord) => {
  return {
    publicId: record.publicId,
    title: record.title,
    ingestStatus: mapIngestStatus(record.ingestStatus),
    sourceLang: mapSourceLanguage(record.sourceLang),
    translated: record.translated,
    createdAt: record.createdAt,
    instapaperBookmarkId: record.instapaperBookmarkId,
  };
};

const hydrateUnreadBookmarks = async (
  userId: string,
  unread: Array<{
    bookmarkId: string;
    url: string;
    title: string;
    description: string;
  }>,
) => {
  const normalized = normalizeUnreadBookmarks(unread);
  const localByUrl = await listArticlesByNormalizedUrl(
    userId,
    toUniqueNormalizedUrls(normalized),
  );

  return normalized.map((bookmark) => {
    let localArticle = null;

    if (bookmark.normalizedUrl) {
      const local = localByUrl.get(bookmark.normalizedUrl);
      if (local) {
        localArticle = mapLocalReaderArticle(local);
      }
    }

    return {
      bookmarkId: bookmark.bookmarkId,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      normalizedUrl: bookmark.normalizedUrl,
      urlError: bookmark.urlError,
      localArticle,
    };
  });
};

const mapReaderSaveError = (error: unknown): never => {
  if (error instanceof ReaderSaveError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message:
      error instanceof Error
        ? error.message
        : "Unexpected Reader save error.",
  });
};

const mapInstapaperError = (error: unknown): never => {
  if (error instanceof InstapaperApiError) {
    if (error.kind === "auth") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: error.message,
      });
    }

    if (error.kind === "network") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }

    if (error.kind === "api" || error.kind === "bad_response") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error.message,
      });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message:
      error instanceof Error
        ? error.message
        : "Unexpected Instapaper integration error.",
  });
};

const pushImportError = (
  errors: string[],
  bookmarkTitle: string,
  error: unknown,
): void => {
  if (errors.length >= 20) {
    return;
  }

  const message =
    error instanceof Error ? error.message : "Unexpected import error.";

  errors.push(`${bookmarkTitle}: ${message}`);
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const renderMarkdownToHtml = (value: string): string => {
  const markdown = value.trim();
  if (!markdown) {
    return "";
  }

  try {
    return renderToStaticMarkup(
      createElement(ReactMarkdown, null, markdown),
    );
  } catch {
    return "";
  }
};

const buildPrivateInstapaperContent = (input: {
  title: string;
  htmlContent: string;
  textContent: string;
}): string => {
  const markdownHtml = renderMarkdownToHtml(input.textContent);
  const fallbackHtml = input.htmlContent.trim()
    ? input.htmlContent.trim()
    : plainTextToHtmlParagraphs(input.textContent);
  const body = markdownHtml || fallbackHtml;

  const heading = `<h1>${escapeHtml(input.title)}</h1>`;

  return [
    "<!doctype html>",
    '<html lang="ko">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(input.title)}</title>`,
    "</head>",
    "<body>",
    heading,
    body,
    "</body>",
    "</html>",
  ].join("");
};

const mapConnectionStatus = (
  credential: ReaderInstapaperCredentialRecord | null,
) => {
  if (!credential) {
    return {
      connected: false,
      username: null,
      updatedAt: null,
    };
  }

  return {
    connected: true,
    username: credential.instapaperUsername,
    updatedAt: credential.updatedAt,
  };
};

const readStoredInstapaperCredential = async (
  userId: string,
): Promise<ReaderInstapaperCredentialRecord | null> => {
  return prismaClient.readerInstapaperCredential.findUnique({
    where: { userId },
    select: {
      id: true,
      instapaperUsername: true,
      encryptedAccessToken: true,
      encryptedAccessSecret: true,
      updatedAt: true,
    },
  });
};

const buildStoredInstapaperSession = (
  credential: ReaderInstapaperCredentialRecord,
): InstapaperSession => {
  try {
    const token = decryptReaderSecret(credential.encryptedAccessToken);
    const secret = decryptReaderSecret(credential.encryptedAccessSecret);

    return {
      accessToken: {
        token,
        secret,
      },
    };
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Instapaper connection is no longer readable. Please reconnect Instapaper.",
    });
  }
};

const requireStoredInstapaperSession = async (
  userId: string,
): Promise<InstapaperSession> => {
  const credential = await readStoredInstapaperCredential(userId);

  if (!credential) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Connect Instapaper first.",
    });
  }

  return buildStoredInstapaperSession(credential);
};

export const getReaderInstapaperConnectionRoute = procedure
  .input(z.object({}))
  .output(instapaperConnectionSchema)
  .query(async ({ ctx }) => {
    const userId = requireUserId(ctx.user?.id);
    const credential = await readStoredInstapaperCredential(userId);
    return mapConnectionStatus(credential);
  });

export const connectReaderInstapaperRoute = procedure
  .input(connectInstapaperInputSchema)
  .output(instapaperConnectionSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    try {
      const session = await createInstapaperSession(input);

      const connected =
        await prismaClient.readerInstapaperCredential.upsert({
          where: { userId },
          create: {
            userId,
            instapaperUsername: input.username.trim(),
            encryptedAccessToken: encryptReaderSecret(
              session.accessToken.token,
            ),
            encryptedAccessSecret: encryptReaderSecret(
              session.accessToken.secret,
            ),
          },
          update: {
            instapaperUsername: input.username.trim(),
            encryptedAccessToken: encryptReaderSecret(
              session.accessToken.token,
            ),
            encryptedAccessSecret: encryptReaderSecret(
              session.accessToken.secret,
            ),
          },
          select: {
            id: true,
            instapaperUsername: true,
            encryptedAccessToken: true,
            encryptedAccessSecret: true,
            updatedAt: true,
          },
        });

      return mapConnectionStatus(connected);
    } catch (error) {
      return mapInstapaperError(error);
    }
  });

export const disconnectReaderInstapaperRoute = procedure
  .input(z.object({}))
  .output(disconnectInstapaperOutputSchema)
  .mutation(async ({ ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    await prismaClient.readerInstapaperCredential.deleteMany({
      where: { userId },
    });

    return {
      status: "disconnected",
    };
  });

export const listReaderInstapaperUnreadRoute = procedure
  .input(listUnreadInputSchema)
  .output(listUnreadOutputSchema)
  .mutation(async ({ ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    try {
      const session = await requireStoredInstapaperSession(userId);
      const unread = await listInstapaperUnreadBookmarks(session);
      const bookmarks = await hydrateUnreadBookmarks(userId, unread);

      return { bookmarks };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      return mapInstapaperError(error);
    }
  });

export const importReaderInstapaperUnreadRoute = procedure
  .input(importUnreadInputSchema)
  .output(importUnreadOutputSchema)
  .mutation(async ({ ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    try {
      const session = await requireStoredInstapaperSession(userId);
      const unread = await listInstapaperUnreadBookmarks(session);
      const normalized = normalizeUnreadBookmarks(unread);
      const localByUrl = await listArticlesByNormalizedUrl(
        userId,
        toUniqueNormalizedUrls(normalized),
      );
      const handledNormalizedUrls = new Set(localByUrl.keys());

      let imported = 0;
      let duplicates = 0;
      let invalidUrls = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const bookmark of normalized) {
        if (!bookmark.normalizedUrl) {
          invalidUrls += 1;
          continue;
        }

        const existing = localByUrl.get(bookmark.normalizedUrl);
        if (handledNormalizedUrls.has(bookmark.normalizedUrl)) {
          duplicates += 1;

          if (
            existing &&
            existing.instapaperBookmarkId !== bookmark.bookmarkId
          ) {
            await prismaClient.readerArticle.update({
              where: { id: existing.id },
              data: {
                instapaperBookmarkId: bookmark.bookmarkId,
              },
            });
            existing.instapaperBookmarkId = bookmark.bookmarkId;
          }

          continue;
        }

        try {
          await queueReaderArticle({
            userId,
            requestUrl: bookmark.url,
            saveOrigin: "DASHBOARD",
            suggestedTitle: bookmark.title,
            instapaperBookmarkId: bookmark.bookmarkId,
          });
          imported += 1;
          handledNormalizedUrls.add(bookmark.normalizedUrl);
        } catch (error) {
          failed += 1;
          pushImportError(errors, bookmark.title, error);
        }
      }

      const bookmarks = await hydrateUnreadBookmarks(userId, unread);

      return {
        summary: {
          imported,
          duplicates,
          invalidUrls,
          failed,
        },
        errors,
        bookmarks,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      if (error instanceof ReaderSaveError) {
        return mapReaderSaveError(error);
      }

      return mapInstapaperError(error);
    }
  });

export const exportReaderArticleToInstapaperRoute = procedure
  .input(exportArticleInputSchema)
  .output(exportArticleOutputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx.user?.id);

    try {
      const session = await requireStoredInstapaperSession(userId);
      const article = await prismaClient.readerArticle.findFirst({
        where: {
          userId,
          publicId: input.publicId,
        },
        select: {
          id: true,
          title: true,
          normalizedUrl: true,
          contentHtml: true,
          contentText: true,
          ingestStatus: true,
          instapaperBookmarkId: true,
        },
      });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reader article not found.",
        });
      }

      if (article.ingestStatus !== "READY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This article is still processing. Export after it reaches Ready.",
        });
      }

      const privateContent = buildPrivateInstapaperContent({
        title: article.title,
        htmlContent: article.contentHtml,
        textContent: article.contentText,
      });

      const added = await addPrivateInstapaperBookmark(session, {
        url: article.normalizedUrl,
        title: `${article.title} (한국어)`,
        htmlContent: privateContent,
      });

      const explicitBookmarkId = input.originalBookmarkId?.trim() ?? "";
      const sourceBookmarkId =
        article.instapaperBookmarkId ?? explicitBookmarkId;

      if (
        explicitBookmarkId &&
        article.instapaperBookmarkId !== explicitBookmarkId
      ) {
        await prismaClient.readerArticle.update({
          where: { id: article.id },
          data: {
            instapaperBookmarkId: explicitBookmarkId,
          },
        });
      }

      if (!input.archiveOriginal) {
        return {
          status: "exported",
          exportedBookmarkId: added.bookmarkId,
          archivedOriginal: false,
          archiveError: null,
        };
      }

      if (!sourceBookmarkId) {
        return {
          status: "exported_archive_failed",
          exportedBookmarkId: added.bookmarkId,
          archivedOriginal: false,
          archiveError:
            "Original Instapaper bookmark id is missing, so archive was skipped.",
        };
      }

      try {
        await archiveInstapaperBookmark(session, sourceBookmarkId);
        return {
          status: "exported_and_archived",
          exportedBookmarkId: added.bookmarkId,
          archivedOriginal: true,
          archiveError: null,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Archive request failed.";

        return {
          status: "exported_archive_failed",
          exportedBookmarkId: added.bookmarkId,
          archivedOriginal: false,
          archiveError: message,
        };
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      return mapInstapaperError(error);
    }
  });
