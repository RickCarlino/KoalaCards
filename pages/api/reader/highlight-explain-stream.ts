import { prismaClient } from "@/koala/prisma-client";
import {
  READER_HIGHLIGHT_PROMPT_VERSION,
  sha256Hex,
  type ReaderHighlightAnalysis,
} from "@/koala/reader/highlight-explain";
import {
  baseHighlightStreamBodySchema,
  errorAnalysisData,
  inProgressAnalysisData,
  parseHighlightStreamBody,
  readyAnalysisData,
  resolveHighlightSelection,
  type HighlightOccurrenceRecord,
} from "@/koala/reader/highlight-stream-shared";
import { requireTextOpenAiApiKey } from "@/koala/api/next-api";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  runHighlightAnalysisStream,
  streamGeneratedSelectionResponse,
} from "./highlight-generation-helpers";
import {
  requirePostMethod,
  requireReaderApiUserId,
} from "./highlight-stream-helpers";

const bodySchema = baseHighlightStreamBodySchema;

type StreamRequestBody = z.infer<typeof bodySchema>;

type CachedHighlightRecord = {
  id: number;
  status: "IN_PROGRESS" | "READY" | "ERROR";
  selectedText: string;
  term: string;
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
};

type OwnedArticleRecord = {
  id: number;
  title: string;
  contentText: string;
};

function parseBody(
  req: NextApiRequest,
  res: NextApiResponse,
): StreamRequestBody | null {
  return parseHighlightStreamBody(bodySchema, req.body, res);
}

async function requireOwnedArticle(
  publicId: string,
  userId: string,
  res: NextApiResponse,
): Promise<OwnedArticleRecord | null> {
  const article = await prismaClient.readerArticle.findUnique({
    where: { publicId },
    select: {
      id: true,
      userId: true,
      title: true,
      contentText: true,
      ingestStatus: true,
    },
  });

  if (!article) {
    res.status(404).end("Article not found.");
    return null;
  }

  if (article.userId !== userId) {
    res.status(403).end("Forbidden");
    return null;
  }

  if (article.ingestStatus !== "READY") {
    res.status(409).end("Article is not ready.");
    return null;
  }

  return {
    id: article.id,
    title: article.title,
    contentText: article.contentText,
  };
}

async function loadCachedHighlight(options: {
  userId: string;
  articleId: number;
  selectedTextHash: string;
  selectedOccurrenceIndex: number;
  articleContentHash: string;
}): Promise<CachedHighlightRecord | null> {
  return prismaClient.readerArticleHighlight.findUnique({
    where: {
      userId_articleId_selectedTextHash_selectedOccurrenceIndex_articleContentHash_promptVersion:
        {
          userId: options.userId,
          articleId: options.articleId,
          selectedTextHash: options.selectedTextHash,
          selectedOccurrenceIndex: options.selectedOccurrenceIndex,
          articleContentHash: options.articleContentHash,
          promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
        },
    },
    select: {
      id: true,
      status: true,
      selectedText: true,
      term: true,
      definition: true,
      generalMeaning: true,
      meaningInContext: true,
    },
  });
}

async function upsertHighlight(options: {
  userId: string;
  articleId: number;
  selectedText: string;
  selectedTextHash: string;
  selectedOccurrenceIndex: number;
  occurrenceCount: number;
  occurrencesJson: HighlightOccurrenceRecord[];
  articleContentHash: string;
}): Promise<number> {
  const record = await prismaClient.readerArticleHighlight.upsert({
    where: {
      userId_articleId_selectedTextHash_selectedOccurrenceIndex_articleContentHash_promptVersion:
        {
          userId: options.userId,
          articleId: options.articleId,
          selectedTextHash: options.selectedTextHash,
          selectedOccurrenceIndex: options.selectedOccurrenceIndex,
          articleContentHash: options.articleContentHash,
          promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
        },
    },
    create: {
      userId: options.userId,
      articleId: options.articleId,
      selectedText: options.selectedText,
      selectedTextHash: options.selectedTextHash,
      selectedOccurrenceIndex: options.selectedOccurrenceIndex,
      occurrenceCount: options.occurrenceCount,
      occurrencesJson: options.occurrencesJson,
      articleContentHash: options.articleContentHash,
      promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
      ...inProgressAnalysisData(),
    },
    update: {
      selectedText: options.selectedText,
      selectedOccurrenceIndex: options.selectedOccurrenceIndex,
      occurrenceCount: options.occurrenceCount,
      occurrencesJson: options.occurrencesJson,
      ...inProgressAnalysisData(),
    },
    select: { id: true },
  });

  return record.id;
}

async function markHighlightReady(
  highlightId: number,
  analysis: ReaderHighlightAnalysis,
): Promise<void> {
  await prismaClient.readerArticleHighlight.update({
    where: { id: highlightId },
    data: readyAnalysisData(analysis),
  });
}

async function markHighlightError(
  highlightId: number,
  message: string,
): Promise<void> {
  await prismaClient.readerArticleHighlight.update({
    where: { id: highlightId },
    data: errorAnalysisData(message),
  });
}

type ResolvedExplainRequest = {
  userId: string;
  article: OwnedArticleRecord;
  selectedText: string;
  selectedTextHash: string;
  articleContentHash: string;
  selectedOccurrenceIndex: number;
  occurrences: HighlightOccurrenceRecord[];
};

async function resolveExplainRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<ResolvedExplainRequest | null> {
  if (!requirePostMethod(req, res)) {
    return null;
  }

  if (!requireTextOpenAiApiKey(res)) {
    return null;
  }

  const parsedBody = parseBody(req, res);
  if (!parsedBody) {
    return null;
  }

  const userId = await requireReaderApiUserId(req, res);
  if (!userId) {
    return null;
  }

  const article = await requireOwnedArticle(
    parsedBody.publicId,
    userId,
    res,
  );
  if (!article) {
    return null;
  }

  const selection = resolveHighlightSelection({
    body: parsedBody,
    missingMessage: "Selected text was not found in this article content.",
    res,
    sourceText: article.contentText,
  });
  if (!selection) {
    return null;
  }

  return {
    userId,
    article,
    selectedText: selection.selectedText,
    selectedTextHash: sha256Hex(selection.selectedText),
    articleContentHash: sha256Hex(selection.sourceText),
    selectedOccurrenceIndex: selection.selectedOccurrenceIndex,
    occurrences: selection.occurrences,
  };
}

async function streamGeneratedResponse(options: {
  res: NextApiResponse;
  isClosed: () => boolean;
  resolved: ResolvedExplainRequest;
}): Promise<void> {
  const { resolved, res, isClosed } = options;
  const {
    userId,
    article,
    selectedText,
    selectedTextHash,
    articleContentHash,
    selectedOccurrenceIndex,
    occurrences,
  } = resolved;

  await streamGeneratedSelectionResponse({
    res,
    isClosed,
    title: article.title,
    selection: resolved,
    createInProgressRecord: () =>
      upsertHighlight({
        userId,
        articleId: article.id,
        selectedText,
        selectedTextHash,
        selectedOccurrenceIndex,
        occurrenceCount: occurrences.length,
        occurrencesJson: occurrences,
        articleContentHash,
      }),
    markReady: markHighlightReady,
    markError: markHighlightError,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const resolve = () => resolveExplainRequest(req, res);
  const loadCached = (resolved: ResolvedExplainRequest) =>
    loadCachedHighlight({
      userId: resolved.userId,
      articleId: resolved.article.id,
      selectedTextHash: resolved.selectedTextHash,
      selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
      articleContentHash: resolved.articleContentHash,
    });
  const streamGenerated = (
    resolved: ResolvedExplainRequest,
    isClosed: () => boolean,
  ) => streamGeneratedResponse({ res, isClosed, resolved });

  await runHighlightAnalysisStream({
    req,
    res,
    resolve,
    loadCached,
    cachedSelectedText: (cached) => cached.selectedText,
    streamGenerated,
  });
}
