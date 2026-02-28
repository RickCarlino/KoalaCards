import {
  Prisma,
  ReaderIngestStatus,
  ReaderSaveOrigin,
  ReaderSourceLanguage,
} from "@prisma/client";
import { prismaClient } from "@/koala/prisma-client";
import {
  fetchArticleSnapshot,
  normalizeSourceUrl,
  plainTextToHtmlParagraphs,
} from "@/koala/reader/article";
import {
  detectSourceLanguage,
  extractArticleContentFromPage,
  tidyKoreanArticleMarkdown,
  translateEnglishToKorean,
} from "@/koala/reader/language";

export type ReaderLanguage = "ko" | "en" | "other";
export type ReaderIngestState =
  | "pending"
  | "in_progress"
  | "ready"
  | "error";
export type ReaderSaveOriginValue = "DASHBOARD" | "BOOKMARKLET";
export type ReaderRouteErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR";

const readerArticleSummarySelect = {
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
} satisfies Prisma.ReaderArticleSelect;

const readerIngestJobSelect = {
  id: true,
  requestUrl: true,
  title: true,
} satisfies Prisma.ReaderArticleSelect;

type ReaderArticleSummaryRecord = Prisma.ReaderArticleGetPayload<{
  select: typeof readerArticleSummarySelect;
}>;

export type ReaderIngestJob = Prisma.ReaderArticleGetPayload<{
  select: typeof readerIngestJobSelect;
}>;

export class ReaderSaveError extends Error {
  code: ReaderRouteErrorCode;
  status: number;

  constructor(
    message: string,
    code: ReaderRouteErrorCode,
    status: number,
  ) {
    super(message);
    this.name = "ReaderSaveError";
    this.code = code;
    this.status = status;
  }
}

export type SavedReaderArticle = {
  id: number;
  publicId: string;
  title: string;
  normalizedUrl: string;
  description: string;
  sourceLang: ReaderLanguage;
  translated: boolean;
  ingestStatus: ReaderIngestState;
  ingestError: string;
  createdAt: Date;
};

type QueueReaderArticleInput = {
  userId: string;
  requestUrl: string;
  saveOrigin: ReaderSaveOriginValue;
  suggestedTitle?: string;
};

type ProcessedReaderArticle = {
  normalizedUrl: string;
  title: string;
  description: string;
  sourceLang: ReaderLanguage;
  translated: boolean;
  contentText: string;
  contentHtml: string;
};

const READER_ERROR_LENGTH_LIMIT = 1800;

const toReaderSourceLanguage = (
  value: ReaderLanguage,
): ReaderSourceLanguage => {
  if (value === "ko") {
    return "KO";
  }

  if (value === "en") {
    return "EN";
  }

  return "OTHER";
};

const fromReaderSourceLanguage = (
  value: ReaderSourceLanguage,
): ReaderLanguage => {
  if (value === "KO") {
    return "ko";
  }

  if (value === "EN") {
    return "en";
  }

  return "other";
};

const fromReaderIngestStatus = (
  value: ReaderIngestStatus,
): ReaderIngestState => {
  if (value === "PENDING") {
    return "pending";
  }

  if (value === "IN_PROGRESS") {
    return "in_progress";
  }

  if (value === "READY") {
    return "ready";
  }

  return "error";
};

const normalizeSuggestedTitle = (title?: string): string => {
  if (!title) {
    return "";
  }

  return title.trim().slice(0, 400);
};

const queuedTitleFor = (
  normalizedUrl: string,
  suggestedTitle?: string,
): string => {
  const normalizedSuggestion = normalizeSuggestedTitle(suggestedTitle);
  if (normalizedSuggestion) {
    return normalizedSuggestion;
  }

  return new URL(normalizedUrl).hostname;
};

const chooseSavedTitle = (
  extractedTitle: string,
  suggestedTitle?: string,
): string => {
  const normalizedSuggestion = normalizeSuggestedTitle(suggestedTitle);

  if (!extractedTitle.trim()) {
    return normalizedSuggestion || "Untitled article";
  }

  if (
    extractedTitle.trim().toLowerCase() === "untitled article" &&
    normalizedSuggestion
  ) {
    return normalizedSuggestion;
  }

  return extractedTitle.trim();
};

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof ReaderSaveError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unexpected reader error.";
};

const clampErrorMessage = (message: string): string => {
  const normalized = message.trim();
  if (!normalized) {
    return "Unexpected reader error.";
  }

  return normalized.slice(0, READER_ERROR_LENGTH_LIMIT);
};

const normalizeRequestUrl = (rawUrl: string): string => {
  try {
    return normalizeSourceUrl(rawUrl);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not parse article URL.";
    throw new ReaderSaveError(message, "BAD_REQUEST", 400);
  }
};

const mapSavedArticle = (
  article: ReaderArticleSummaryRecord,
): SavedReaderArticle => {
  return {
    id: article.id,
    publicId: article.publicId,
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    description: article.description,
    sourceLang: fromReaderSourceLanguage(article.sourceLang),
    translated: article.translated,
    ingestStatus: fromReaderIngestStatus(article.ingestStatus),
    ingestError: article.ingestError,
    createdAt: article.createdAt,
  };
};

const processReaderArticleText = async (
  requestUrl: string,
  suggestedTitle?: string,
): Promise<ProcessedReaderArticle> => {
  let snapshot;
  try {
    snapshot = await fetchArticleSnapshot(requestUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not fetch article.";
    throw new ReaderSaveError(message, "BAD_REQUEST", 400);
  }

  let extractedArticle = "";
  try {
    extractedArticle = await extractArticleContentFromPage({
      title: snapshot.title,
      description: snapshot.description,
      pageText: snapshot.text,
      pageHtml: snapshot.htmlContent,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not isolate article content.";
    throw new ReaderSaveError(message, "INTERNAL_SERVER_ERROR", 500);
  }

  if (!extractedArticle.trim()) {
    throw new ReaderSaveError(
      "Could not isolate main article content from this page.",
      "BAD_REQUEST",
      400,
    );
  }

  const sourceLanguage = await detectSourceLanguage(
    [snapshot.title, snapshot.description, extractedArticle]
      .filter((part) => part.trim().length > 0)
      .join("\n\n"),
  );

  if (sourceLanguage === "other") {
    throw new ReaderSaveError(
      "Only English or Korean articles are supported right now.",
      "BAD_REQUEST",
      400,
    );
  }

  let translated = false;
  let koreanText = extractedArticle;

  if (sourceLanguage === "en") {
    try {
      koreanText = await translateEnglishToKorean(extractedArticle);
      translated = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not translate this article.";
      throw new ReaderSaveError(message, "INTERNAL_SERVER_ERROR", 500);
    }
  }

  try {
    koreanText = await tidyKoreanArticleMarkdown(koreanText);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not format this article.";
    throw new ReaderSaveError(message, "INTERNAL_SERVER_ERROR", 500);
  }

  return {
    normalizedUrl: snapshot.normalizedUrl,
    title: chooseSavedTitle(snapshot.title, suggestedTitle),
    description: snapshot.description,
    sourceLang: sourceLanguage,
    translated,
    contentText: koreanText,
    contentHtml: plainTextToHtmlParagraphs(koreanText),
  };
};

export const queueReaderArticle = async (
  input: QueueReaderArticleInput,
): Promise<SavedReaderArticle> => {
  const requestUrl = input.requestUrl.trim();
  if (!requestUrl) {
    throw new ReaderSaveError(
      "Please provide an article URL.",
      "BAD_REQUEST",
      400,
    );
  }

  const normalizedRequestUrl = normalizeRequestUrl(requestUrl);
  const saveOrigin: ReaderSaveOrigin = input.saveOrigin;

  const saved = await prismaClient.readerArticle.create({
    data: {
      userId: input.userId,
      requestUrl: normalizedRequestUrl,
      normalizedUrl: normalizedRequestUrl,
      title: queuedTitleFor(normalizedRequestUrl, input.suggestedTitle),
      description: "",
      sourceLang: "OTHER",
      translated: false,
      saveOrigin,
      ingestStatus: "PENDING",
      ingestError: "",
      ingestStartedAt: null,
      ingestedAt: null,
      contentText: "",
      contentHtml: "",
    },
    select: readerArticleSummarySelect,
  });

  return mapSavedArticle(saved);
};

export const claimNextQueuedReaderArticle =
  async (): Promise<ReaderIngestJob | null> => {
    const nextPending = await prismaClient.readerArticle.findFirst({
      where: { ingestStatus: "PENDING" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    if (!nextPending) {
      return null;
    }

    const claim = await prismaClient.readerArticle.updateMany({
      where: {
        id: nextPending.id,
        ingestStatus: "PENDING",
      },
      data: {
        ingestStatus: "IN_PROGRESS",
        ingestError: "",
        ingestStartedAt: new Date(),
      },
    });

    if (claim.count === 0) {
      return null;
    }

    return prismaClient.readerArticle.findUnique({
      where: { id: nextPending.id },
      select: readerIngestJobSelect,
    });
  };

export const processClaimedReaderArticle = async (
  job: ReaderIngestJob,
): Promise<SavedReaderArticle> => {
  const processed = await processReaderArticleText(
    job.requestUrl,
    job.title,
  );

  const saved = await prismaClient.readerArticle.update({
    where: { id: job.id },
    data: {
      normalizedUrl: processed.normalizedUrl,
      title: processed.title,
      description: processed.description,
      sourceLang: toReaderSourceLanguage(processed.sourceLang),
      translated: processed.translated,
      contentText: processed.contentText,
      contentHtml: processed.contentHtml,
      ingestStatus: "READY",
      ingestError: "",
      ingestedAt: new Date(),
    },
    select: readerArticleSummarySelect,
  });

  return mapSavedArticle(saved);
};

export const markReaderArticleIngestError = async (
  articleId: number,
  error: unknown,
): Promise<void> => {
  await prismaClient.readerArticle.update({
    where: { id: articleId },
    data: {
      ingestStatus: "ERROR",
      ingestError: clampErrorMessage(normalizeErrorMessage(error)),
      ingestedAt: new Date(),
    },
  });
};

export const requeueStaleReaderArticles = async (
  staleAfterMinutes: number,
): Promise<number> => {
  if (staleAfterMinutes <= 0) {
    return 0;
  }

  const staleBefore = new Date(Date.now() - staleAfterMinutes * 60 * 1000);

  const result = await prismaClient.readerArticle.updateMany({
    where: {
      ingestStatus: "IN_PROGRESS",
      ingestStartedAt: {
        lt: staleBefore,
      },
    },
    data: {
      ingestStatus: "PENDING",
      ingestStartedAt: null,
      ingestError: "",
    },
  });

  return result.count;
};
