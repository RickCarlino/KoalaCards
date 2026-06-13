import { prismaClient } from "@/koala/prisma-client";
import {
  buildOccurrenceContexts,
  selectOccurrenceIndex,
} from "@/koala/reader/highlight-context";
import {
  READER_HIGHLIGHT_CONTEXT_RADIUS,
  READER_HIGHLIGHT_PROMPT_VERSION,
  sha256Hex,
  type ReaderHighlightAnalysis,
} from "@/koala/reader/highlight-explain";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  streamCachedAnalysisResponse,
  streamGeneratedAnalysisResponse,
} from "./highlight-generation-helpers";
import {
  requirePostMethod,
  requireReaderApiUserId,
  startSSE,
} from "./highlight-stream-helpers";

const bodySchema = z.object({
  publicId: z.string().trim().min(1),
  selectedText: z.string().trim().min(1).max(220),
  contextBefore: z.string().max(260).optional(),
  contextAfter: z.string().max(260).optional(),
  occurrenceHint: z.number().int().min(0).optional(),
});

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

function normalizeArticleText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseBody(
  req: NextApiRequest,
  res: NextApiResponse,
): StreamRequestBody | null {
  const parsed = bodySchema.safeParse(req.body);
  if (parsed.success) {
    return parsed.data;
  }

  res.status(400).end("Invalid request body.");
  return null;
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
  occurrencesJson: Array<{
    index: number;
    startOffset: number;
    endOffset: number;
    before: string;
    match: string;
    after: string;
  }>;
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
      status: "IN_PROGRESS",
      term: "",
      definition: "",
      generalMeaning: "",
      meaningInContext: "",
      errorMessage: "",
    },
    update: {
      selectedText: options.selectedText,
      selectedOccurrenceIndex: options.selectedOccurrenceIndex,
      occurrenceCount: options.occurrenceCount,
      occurrencesJson: options.occurrencesJson,
      status: "IN_PROGRESS",
      term: "",
      definition: "",
      generalMeaning: "",
      meaningInContext: "",
      errorMessage: "",
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
    data: {
      status: "READY",
      term: analysis.term,
      definition: analysis.definition,
      generalMeaning: analysis.generalMeaning,
      meaningInContext: analysis.meaningInContext,
      errorMessage: "",
    },
  });
}

async function markHighlightError(
  highlightId: number,
  message: string,
): Promise<void> {
  await prismaClient.readerArticleHighlight.update({
    where: { id: highlightId },
    data: {
      status: "ERROR",
      errorMessage: message,
    },
  });
}

type ResolvedExplainRequest = {
  userId: string;
  article: OwnedArticleRecord;
  selectedText: string;
  selectedTextHash: string;
  articleContentHash: string;
  selectedOccurrenceIndex: number;
  occurrences: Array<{
    index: number;
    startOffset: number;
    endOffset: number;
    before: string;
    match: string;
    after: string;
  }>;
};

async function resolveExplainRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<ResolvedExplainRequest | null> {
  if (!requirePostMethod(req, res)) {
    return null;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).end("Missing OPENAI_API_KEY");
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

  const articleText = normalizeArticleText(article.contentText);
  const selectedText = parsedBody.selectedText.trim();
  const occurrences = buildOccurrenceContexts(
    articleText,
    selectedText,
    READER_HIGHLIGHT_CONTEXT_RADIUS,
  );

  if (occurrences.length === 0) {
    res
      .status(400)
      .end("Selected text was not found in this article content.");
    return null;
  }

  const selectedOccurrenceIndex = selectOccurrenceIndex({
    occurrences,
    contextBefore: parsedBody.contextBefore ?? "",
    contextAfter: parsedBody.contextAfter ?? "",
    occurrenceHint: parsedBody.occurrenceHint,
  });

  if (selectedOccurrenceIndex < 0) {
    res.status(400).end("Could not resolve selected occurrence.");
    return null;
  }

  return {
    userId,
    article,
    selectedText,
    selectedTextHash: sha256Hex(selectedText),
    articleContentHash: sha256Hex(articleText),
    selectedOccurrenceIndex,
    occurrences,
  };
}

async function streamGeneratedResponse(options: {
  res: NextApiResponse;
  isClosed: () => boolean;
  resolved: ResolvedExplainRequest;
}): Promise<void> {
  const {
    resolved: {
      userId,
      article,
      selectedText,
      selectedTextHash,
      articleContentHash,
      selectedOccurrenceIndex,
      occurrences,
    },
    res,
    isClosed,
  } = options;

  await streamGeneratedAnalysisResponse({
    res,
    isClosed,
    title: article.title,
    selectedText,
    selectedOccurrenceIndex,
    occurrenceCount: occurrences.length,
    occurrences,
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
  const resolved = await resolveExplainRequest(req, res);
  if (!resolved) {
    return;
  }

  const cached = await loadCachedHighlight({
    userId: resolved.userId,
    articleId: resolved.article.id,
    selectedTextHash: resolved.selectedTextHash,
    selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
    articleContentHash: resolved.articleContentHash,
  });

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  startSSE(res);
  const isClosed = () => closed;

  if (
    cached &&
    streamCachedAnalysisResponse({
      res,
      isClosed,
      cached,
      selectedText: cached.selectedText,
    })
  ) {
    return;
  }

  await streamGeneratedResponse({ res, isClosed, resolved });
}
