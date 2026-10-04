import {
  Prisma,
  ReaderIngestStatus,
  ReaderInputKind,
} from "@/koala/generated/prisma/client";
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
} from "@/koala/reader/language";

export type ReaderIngestState =
  "pending" | "in_progress" | "ready" | "error";
export type ReaderInputKindValue = "url" | "raw";
export type ReaderRouteErrorCode =
  "BAD_REQUEST" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR";

const readerArticleSummarySelect = {
  id: true,
  publicId: true,
  title: true,
  normalizedUrl: true,
  inputKind: true,
  description: true,
  ingestStatus: true,
  ingestError: true,
  readAt: true,
  lastReadAt: true,
  createdAt: true,
} satisfies Prisma.ReaderArticleSelect;

const readerIngestJobSelect = {
  id: true,
  requestUrl: true,
  inputKind: true,
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
  normalizedUrl: string | null;
  inputKind: ReaderInputKindValue;
  description: string;
  ingestStatus: ReaderIngestState;
  ingestError: string;
  readAt: Date | null;
  lastReadAt: Date | null;
  createdAt: Date;
};

type QueueReaderArticleInput = {
  userId: string;
  requestUrl: string;
  suggestedTitle?: string;
};

type SaveReaderRawTextInput = {
  userId: string;
  title?: string;
  text: string;
};

type ProcessedReaderArticle = {
  normalizedUrl: string;
  title: string;
  description: string;
  contentText: string;
  contentHtml: string;
};

const READER_ERROR_LENGTH_LIMIT = 1800;
const READER_RAW_TEXT_LENGTH_LIMIT = 240000;

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

const fromReaderInputKind = (
  value: ReaderInputKind,
): ReaderInputKindValue => {
  if (value === "RAW") {
    return "raw";
  }

  return "url";
};

const normalizeSuggestedTitle = (title?: string): string => {
  if (!title) {
    return "";
  }

  return title.trim().slice(0, 400);
};

const normalizeRawTextInput = (value: string): string => {
  if (!value.trim()) {
    throw new ReaderSaveError(
      "Please paste some text.",
      "BAD_REQUEST",
      400,
    );
  }

  if (value.length > READER_RAW_TEXT_LENGTH_LIMIT) {
    throw new ReaderSaveError(
      `Raw text is too long. Limit is ${READER_RAW_TEXT_LENGTH_LIMIT.toLocaleString()} characters.`,
      "BAD_REQUEST",
      400,
    );
  }

  return value;
};

const titleForRawText = (title?: string): string => {
  const normalized = normalizeSuggestedTitle(title);
  if (normalized) {
    return normalized;
  }

  return "Untitled text";
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

const hostFromUrl = (value: string): string => {
  try {
    return new URL(value).hostname;
  } catch {
    return "unknown";
  }
};

const logIngestInfo = (
  message: string,
  details: Record<string, unknown>,
): void => {
  console.log(`[reader-ingest] ${message}`, details);
};

const logIngestError = (
  message: string,
  details: Record<string, unknown>,
): void => {
  console.error(`[reader-ingest] ${message}`, details);
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
    inputKind: fromReaderInputKind(article.inputKind),
    description: article.description,
    ingestStatus: fromReaderIngestStatus(article.ingestStatus),
    ingestError: article.ingestError,
    readAt: article.readAt,
    lastReadAt: article.lastReadAt,
    createdAt: article.createdAt,
  };
};

const processReaderArticleText = async (
  requestUrl: string,
  suggestedTitle?: string,
): Promise<ProcessedReaderArticle> => {
  const totalStartedAtMs = Date.now();
  const requestHost = hostFromUrl(requestUrl);

  logIngestInfo("process-start", {
    requestHost,
  });

  let snapshot;
  try {
    const fetchStartedAtMs = Date.now();
    snapshot = await fetchArticleSnapshot(requestUrl);
    logIngestInfo("fetch-complete", {
      requestHost,
      fetchMs: Date.now() - fetchStartedAtMs,
      pageTextLength: snapshot.text.length,
      pageHtmlLength: snapshot.htmlContent.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not fetch article.";
    logIngestError("fetch-failed", {
      requestHost,
      errorMessage: message,
    });
    throw new ReaderSaveError(message, "BAD_REQUEST", 400);
  }

  const detectStartedAtMs = Date.now();
  const sourceLanguage = await detectSourceLanguage(
    [snapshot.title, snapshot.description, snapshot.text]
      .filter((part) => part.trim().length > 0)
      .join("\n\n"),
  );
  logIngestInfo("language-detected", {
    requestHost,
    sourceLanguage,
    detectMs: Date.now() - detectStartedAtMs,
  });

  if (sourceLanguage !== "ko") {
    logIngestError("language-unsupported", {
      requestHost,
      sourceLanguage,
    });
    throw new ReaderSaveError(
      "Unable to parse article (not Korean?)",
      "BAD_REQUEST",
      400,
    );
  }

  let extractedArticle = "";
  try {
    const extractStartedAtMs = Date.now();
    extractedArticle = await extractArticleContentFromPage({
      title: snapshot.title,
      description: snapshot.description,
      pageText: snapshot.text,
      pageHtml: snapshot.htmlContent,
    });
    logIngestInfo("extract-complete", {
      requestHost,
      extractMs: Date.now() - extractStartedAtMs,
      extractedLength: extractedArticle.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not isolate article content.";
    logIngestError("extract-failed", {
      requestHost,
      errorMessage: message,
    });
    throw new ReaderSaveError(message, "INTERNAL_SERVER_ERROR", 500);
  }

  if (!extractedArticle.trim()) {
    logIngestError("extract-empty", {
      requestHost,
    });
    throw new ReaderSaveError(
      "Could not isolate main article content from this page.",
      "BAD_REQUEST",
      400,
    );
  }

  let koreanText = extractedArticle;

  try {
    const tidyStartedAtMs = Date.now();
    koreanText = await tidyKoreanArticleMarkdown(koreanText);
    logIngestInfo("tidy-complete", {
      requestHost,
      tidyMs: Date.now() - tidyStartedAtMs,
      tidyLength: koreanText.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not format this article.";
    logIngestError("tidy-failed", {
      requestHost,
      errorMessage: message,
    });
    throw new ReaderSaveError(message, "INTERNAL_SERVER_ERROR", 500);
  }

  logIngestInfo("process-complete", {
    requestHost,
    sourceLanguage,
    totalMs: Date.now() - totalStartedAtMs,
  });

  return {
    normalizedUrl: snapshot.normalizedUrl,
    title: chooseSavedTitle(snapshot.title, suggestedTitle),
    description: snapshot.description,
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

  const saved = await prismaClient.readerArticle.create({
    data: {
      userId: input.userId,
      requestUrl: normalizedRequestUrl,
      normalizedUrl: normalizedRequestUrl,
      inputKind: "URL",
      title: queuedTitleFor(normalizedRequestUrl, input.suggestedTitle),
      description: "",
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

export const saveReaderRawTextArticle = async (
  input: SaveReaderRawTextInput,
): Promise<SavedReaderArticle> => {
  const rawText = normalizeRawTextInput(input.text);
  const title = titleForRawText(input.title);

  const saved = await prismaClient.readerArticle.create({
    data: {
      userId: input.userId,
      requestUrl: null,
      normalizedUrl: null,
      inputKind: "RAW",
      title,
      description: "",
      ingestStatus: "READY",
      ingestError: "",
      ingestStartedAt: null,
      ingestedAt: new Date(),
      contentText: rawText,
      contentHtml: "",
    },
    select: readerArticleSummarySelect,
  });

  return mapSavedArticle(saved);
};

export const claimNextQueuedReaderArticle =
  async (): Promise<ReaderIngestJob | null> => {
    const nextPending = await prismaClient.readerArticle.findFirst({
      where: {
        ingestStatus: "PENDING",
        inputKind: "URL",
      },
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
  if (job.inputKind !== "URL") {
    throw new ReaderSaveError(
      "Only URL imports can be queued for ingest.",
      "BAD_REQUEST",
      400,
    );
  }

  if (!job.requestUrl?.trim()) {
    throw new ReaderSaveError(
      "Queued URL import is missing a request URL.",
      "BAD_REQUEST",
      400,
    );
  }

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
      contentText: processed.contentText,
      contentHtml: processed.contentHtml,
      ingestStatus: "READY",
      ingestError: "",
      ingestStartedAt: null,
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
      ingestStartedAt: null,
      ingestedAt: new Date(),
    },
  });
};

export const expireStaleReaderArticles = async (
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
      ingestStatus: "ERROR",
      ingestStartedAt: null,
      ingestError: clampErrorMessage(
        `Reader ingest timed out after ${staleAfterMinutes} minutes.`,
      ),
      ingestedAt: new Date(),
    },
  });

  return result.count;
};
