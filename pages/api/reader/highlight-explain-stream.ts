import { Prisma } from "@/koala/generated/prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireTextOpenAiApiKey } from "@/koala/api/next-api";
import { prismaClient } from "@/koala/prisma-client";
import { readerBookLocatorSchema } from "@/koala/reader/book";
import {
  READER_HIGHLIGHT_PROMPT_VERSION,
  sha256Hex,
  type ReaderHighlightAnalysis,
} from "@/koala/reader/highlight-explain";
import { shouldLoadReaderHighlightCache } from "@/koala/reader/highlight-cache";
import {
  baseHighlightStreamBodySchema,
  errorAnalysisData,
  inProgressAnalysisData,
  parseHighlightStreamBody,
  readyAnalysisData,
  resolveHighlightSelection,
  type HighlightOccurrenceRecord,
} from "@/koala/reader/highlight-stream-shared";
import {
  runHighlightAnalysisStream,
  streamGeneratedSelectionResponse,
} from "@/koala/reader/server/highlight-generation-helpers";
import {
  requirePostMethod,
  requireReaderApiUserId,
} from "@/koala/reader/server/highlight-stream-helpers";

const commonBodySchema = baseHighlightStreamBodySchema.extend({
  retry: z.boolean().optional(),
});

const bodySchema = z.discriminatedUnion("kind", [
  commonBodySchema.extend({
    kind: z.literal("article"),
  }),
  commonBodySchema.extend({
    kind: z.literal("book"),
    sectionText: z.string().min(1).max(80000),
    locator: readerBookLocatorSchema,
    chapterTitle: z.string().trim().max(500).optional(),
    progression: z.number().min(0).max(1).optional(),
  }),
]);

type StreamRequestBody = z.infer<typeof bodySchema>;
type ArticleStreamRequestBody = Extract<
  StreamRequestBody,
  { kind: "article" }
>;
type BookStreamRequestBody = Extract<StreamRequestBody, { kind: "book" }>;

type ResolvedExplainRequestBase = {
  userId: string;
  selectedText: string;
  selectedTextHash: string;
  selectedOccurrenceIndex: number;
  occurrences: HighlightOccurrenceRecord[];
  title: string;
  retry: boolean;
};

type ResolvedArticleExplainRequest = ResolvedExplainRequestBase & {
  kind: "article";
  articleId: number;
  articleContentHash: string;
};

type ResolvedBookExplainRequest = ResolvedExplainRequestBase & {
  kind: "book";
  bookId: number;
  sectionTextHash: string;
  locator: BookStreamRequestBody["locator"];
  chapterTitle: string;
  progression: number;
};

type ResolvedExplainRequest =
  ResolvedArticleExplainRequest | ResolvedBookExplainRequest;

type CachedReaderHighlight = {
  id: number;
  status: "IN_PROGRESS" | "READY" | "ERROR";
  selectedText: string;
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
};

type OwnedArticle = {
  id: number;
  title: string;
  contentText: string;
};

type OwnedBook = {
  id: number;
  title: string;
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function requireOwnedArticle(options: {
  publicId: string;
  userId: string;
  res: NextApiResponse;
}): Promise<OwnedArticle | null> {
  const article = await prismaClient.readerArticle.findUnique({
    where: { publicId: options.publicId },
    select: {
      id: true,
      userId: true,
      title: true,
      contentText: true,
      ingestStatus: true,
    },
  });
  if (!article) {
    options.res.status(404).end("Article not found.");
    return null;
  }
  if (article.userId !== options.userId) {
    options.res.status(403).end("Forbidden");
    return null;
  }
  if (article.ingestStatus !== "READY") {
    options.res.status(409).end("Article is not ready.");
    return null;
  }

  return {
    id: article.id,
    title: article.title,
    contentText: article.contentText,
  };
}

async function requireOwnedBook(options: {
  publicId: string;
  userId: string;
  res: NextApiResponse;
}): Promise<OwnedBook | null> {
  const book = await prismaClient.readerBook.findUnique({
    where: { publicId: options.publicId },
    select: { id: true, userId: true, title: true },
  });
  if (!book) {
    options.res.status(404).end("Book not found.");
    return null;
  }
  if (book.userId !== options.userId) {
    options.res.status(403).end("Forbidden");
    return null;
  }

  return { id: book.id, title: book.title };
}

function resolveArticleSelection(options: {
  body: ArticleStreamRequestBody;
  article: OwnedArticle;
  userId: string;
  res: NextApiResponse;
}): ResolvedArticleExplainRequest | null {
  const selection = resolveHighlightSelection({
    body: options.body,
    sourceText: options.article.contentText,
    missingMessage: "Selected text was not found in this article.",
    res: options.res,
  });
  if (!selection) {
    return null;
  }

  return {
    kind: "article",
    userId: options.userId,
    articleId: options.article.id,
    title: options.article.title,
    selectedText: selection.selectedText,
    selectedTextHash: sha256Hex(selection.selectedText),
    selectedOccurrenceIndex: selection.selectedOccurrenceIndex,
    occurrences: selection.occurrences,
    articleContentHash: sha256Hex(selection.sourceText),
    retry: options.body.retry ?? false,
  };
}

function resolveBookSelection(options: {
  body: BookStreamRequestBody;
  book: OwnedBook;
  userId: string;
  res: NextApiResponse;
}): ResolvedBookExplainRequest | null {
  const selection = resolveHighlightSelection({
    body: options.body,
    sourceText: options.body.sectionText,
    missingMessage: "Selected text was not found in this section.",
    res: options.res,
  });
  if (!selection) {
    return null;
  }

  const chapterTitle =
    options.body.chapterTitle ??
    options.body.locator.chapterTitle ??
    options.body.locator.title ??
    "";

  return {
    kind: "book",
    userId: options.userId,
    bookId: options.book.id,
    title: chapterTitle
      ? `${options.book.title} - ${chapterTitle}`
      : options.book.title,
    selectedText: selection.selectedText,
    selectedTextHash: sha256Hex(selection.selectedText),
    selectedOccurrenceIndex: selection.selectedOccurrenceIndex,
    occurrences: selection.occurrences,
    sectionTextHash: sha256Hex(selection.sourceText),
    locator: options.body.locator,
    chapterTitle,
    progression:
      options.body.progression ??
      options.body.locator.totalProgression ??
      options.body.locator.progression ??
      0,
    retry: options.body.retry ?? false,
  };
}

async function resolveExplainRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<ResolvedExplainRequest | null> {
  if (!requirePostMethod(req, res) || !requireTextOpenAiApiKey(res)) {
    return null;
  }

  const body = parseHighlightStreamBody(bodySchema, req.body, res);
  if (!body) {
    return null;
  }

  const userId = await requireReaderApiUserId(req, res);
  if (!userId) {
    return null;
  }

  if (body.kind === "article") {
    const article = await requireOwnedArticle({
      publicId: body.publicId,
      userId,
      res,
    });
    if (!article) {
      return null;
    }
    return resolveArticleSelection({ body, article, userId, res });
  }

  const book = await requireOwnedBook({
    publicId: body.publicId,
    userId,
    res,
  });
  if (!book) {
    return null;
  }
  return resolveBookSelection({ body, book, userId, res });
}

async function loadCachedArticle(
  resolved: ResolvedArticleExplainRequest,
): Promise<CachedReaderHighlight | null> {
  return prismaClient.readerArticleHighlight.findUnique({
    where: {
      userId_articleId_selectedTextHash_selectedOccurrenceIndex_articleContentHash_promptVersion:
        {
          userId: resolved.userId,
          articleId: resolved.articleId,
          selectedTextHash: resolved.selectedTextHash,
          selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
          articleContentHash: resolved.articleContentHash,
          promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
        },
    },
    select: {
      id: true,
      status: true,
      selectedText: true,
      definition: true,
      generalMeaning: true,
      meaningInContext: true,
    },
  });
}

async function loadCachedBook(
  resolved: ResolvedBookExplainRequest,
): Promise<CachedReaderHighlight | null> {
  const cached = await prismaClient.readerBookAnnotation.findUnique({
    where: {
      userId_bookId_selectedTextHash_selectedOccurrenceIndex_sectionTextHash_promptVersion:
        {
          userId: resolved.userId,
          bookId: resolved.bookId,
          selectedTextHash: resolved.selectedTextHash,
          selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
          sectionTextHash: resolved.sectionTextHash,
          promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
        },
    },
    select: {
      id: true,
      status: true,
      quote: true,
      definition: true,
      generalMeaning: true,
      meaningInContext: true,
    },
  });
  if (!cached) {
    return null;
  }

  return {
    ...cached,
    selectedText: cached.quote,
  };
}

async function loadCachedHighlight(
  resolved: ResolvedExplainRequest,
): Promise<CachedReaderHighlight | null> {
  if (
    !shouldLoadReaderHighlightCache({
      kind: resolved.kind,
      retry: resolved.retry,
    })
  ) {
    return null;
  }
  if (resolved.kind === "article") {
    return loadCachedArticle(resolved);
  }

  return loadCachedBook(resolved);
}

async function upsertArticleHighlight(
  resolved: ResolvedArticleExplainRequest,
): Promise<number> {
  const record = await prismaClient.readerArticleHighlight.upsert({
    where: {
      userId_articleId_selectedTextHash_selectedOccurrenceIndex_articleContentHash_promptVersion:
        {
          userId: resolved.userId,
          articleId: resolved.articleId,
          selectedTextHash: resolved.selectedTextHash,
          selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
          articleContentHash: resolved.articleContentHash,
          promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
        },
    },
    create: {
      userId: resolved.userId,
      articleId: resolved.articleId,
      selectedText: resolved.selectedText,
      selectedTextHash: resolved.selectedTextHash,
      selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
      occurrenceCount: resolved.occurrences.length,
      occurrencesJson: toPrismaJson(resolved.occurrences),
      articleContentHash: resolved.articleContentHash,
      promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
      ...inProgressAnalysisData(),
    },
    update: {
      selectedText: resolved.selectedText,
      selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
      occurrenceCount: resolved.occurrences.length,
      occurrencesJson: toPrismaJson(resolved.occurrences),
      ...inProgressAnalysisData(),
    },
    select: { id: true },
  });
  return record.id;
}

async function upsertBookHighlight(
  resolved: ResolvedBookExplainRequest,
): Promise<number> {
  const currentOccurrence =
    resolved.occurrences[resolved.selectedOccurrenceIndex] ?? null;
  const locationData = {
    locatorJson: toPrismaJson(resolved.locator),
    chapterTitle: resolved.chapterTitle,
    progression: resolved.progression,
    quote: resolved.selectedText,
    contextBefore: currentOccurrence?.before ?? "",
    contextAfter: currentOccurrence?.after ?? "",
    selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
    occurrenceCount: resolved.occurrences.length,
    occurrencesJson: toPrismaJson(resolved.occurrences),
  };
  const record = await prismaClient.readerBookAnnotation.upsert({
    where: {
      userId_bookId_selectedTextHash_selectedOccurrenceIndex_sectionTextHash_promptVersion:
        {
          userId: resolved.userId,
          bookId: resolved.bookId,
          selectedTextHash: resolved.selectedTextHash,
          selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
          sectionTextHash: resolved.sectionTextHash,
          promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
        },
    },
    create: {
      userId: resolved.userId,
      bookId: resolved.bookId,
      ...locationData,
      selectedTextHash: resolved.selectedTextHash,
      sectionTextHash: resolved.sectionTextHash,
      promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
      ...inProgressAnalysisData(),
    },
    update: {
      ...locationData,
      ...inProgressAnalysisData(),
    },
    select: { id: true },
  });
  return record.id;
}

async function upsertReaderHighlight(
  resolved: ResolvedExplainRequest,
): Promise<number> {
  if (resolved.kind === "article") {
    return upsertArticleHighlight(resolved);
  }

  return upsertBookHighlight(resolved);
}

async function markReaderHighlightReady(options: {
  resolved: ResolvedExplainRequest;
  highlightId: number;
  analysis: ReaderHighlightAnalysis;
}): Promise<void> {
  if (options.resolved.kind === "article") {
    await prismaClient.readerArticleHighlight.update({
      where: { id: options.highlightId },
      data: readyAnalysisData(options.analysis),
    });
    return;
  }

  await prismaClient.readerBookAnnotation.update({
    where: { id: options.highlightId },
    data: readyAnalysisData(options.analysis),
  });
}

async function markReaderHighlightError(options: {
  resolved: ResolvedExplainRequest;
  highlightId: number;
  message: string;
}): Promise<void> {
  if (options.resolved.kind === "article") {
    await prismaClient.readerArticleHighlight.update({
      where: { id: options.highlightId },
      data: errorAnalysisData(options.message),
    });
    return;
  }

  await prismaClient.readerBookAnnotation.update({
    where: { id: options.highlightId },
    data: errorAnalysisData(options.message),
  });
}

async function streamGeneratedResponse(options: {
  resolved: ResolvedExplainRequest;
  res: NextApiResponse;
  isClosed: () => boolean;
}): Promise<void> {
  await streamGeneratedSelectionResponse({
    res: options.res,
    isClosed: options.isClosed,
    title: options.resolved.title,
    selection: options.resolved,
    createInProgressRecord: () => upsertReaderHighlight(options.resolved),
    markReady: (highlightId, analysis) =>
      markReaderHighlightReady({
        resolved: options.resolved,
        highlightId,
        analysis,
      }),
    markError: (highlightId, message) =>
      markReaderHighlightError({
        resolved: options.resolved,
        highlightId,
        message,
      }),
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  await runHighlightAnalysisStream({
    req,
    res,
    resolve: () => resolveExplainRequest(req, res),
    loadCached: loadCachedHighlight,
    cachedSelectedText: (cached) => cached.selectedText,
    streamGenerated: (resolved, isClosed) =>
      streamGeneratedResponse({ resolved, res, isClosed }),
  });
}
