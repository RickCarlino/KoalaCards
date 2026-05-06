import { generateStructuredOutput } from "@/koala/ai";
import { prismaClient } from "@/koala/prisma-client";
import {
  buildOccurrenceContexts,
  selectOccurrenceIndex,
  takePromptOccurrences,
} from "@/koala/reader/highlight-context";
import {
  buildReaderHighlightPrompt,
  normalizeReaderHighlightAnalysis,
  readerHighlightModelOutputSchema,
  READER_HIGHLIGHT_CONTEXT_RADIUS,
  READER_HIGHLIGHT_MAX_PROMPT_OCCURRENCES,
  READER_HIGHLIGHT_PROMPT_VERSION,
  sha256Hex,
  type ReaderHighlightAnalysis,
} from "@/koala/reader/highlight-explain";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "../auth/[...nextauth]";

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

function writeSSE(
  res: NextApiResponse,
  data: string,
  event?: string,
): void {
  if (event) {
    res.write(`event: ${event}\n`);
  }

  const lines = data.split("\n");
  for (const line of lines) {
    res.write(`data: ${line}\n`);
  }

  res.write("\n");
}

function startSSE(res: NextApiResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
}

function streamDone(res: NextApiResponse, isClosed: boolean): void {
  if (isClosed) {
    return;
  }

  writeSSE(res, "done", "done");
  res.end();
}

function streamError(
  res: NextApiResponse,
  isClosed: boolean,
  message: string,
): void {
  if (isClosed) {
    return;
  }

  writeSSE(res, message, "error");
  streamDone(res, isClosed);
}

function streamAnalysis(
  res: NextApiResponse,
  isClosed: boolean,
  analysis: ReaderHighlightAnalysis,
): void {
  if (isClosed) {
    return;
  }

  writeSSE(res, JSON.stringify(analysis), "analysis");
}

function streamHighlightId(
  res: NextApiResponse,
  isClosed: boolean,
  highlightId: number,
): void {
  if (isClosed) {
    return;
  }

  writeSSE(res, JSON.stringify({ id: highlightId }), "highlight");
}

function normalizeArticleText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 1800);
  }

  return "Unexpected streaming error.";
}

function requirePostMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  if (req.method === "POST") {
    return true;
  }

  res.setHeader("Allow", "POST");
  res.status(405).end("Method Not Allowed");
  return false;
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

async function requireUserId(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    res.status(401).end("Unauthorized");
    return null;
  }

  const user = await prismaClient.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    res.status(401).end("Unauthorized");
    return null;
  }

  return user.id;
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

  const userId = await requireUserId(req, res);
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

function hasReadyAnalysis(record: {
  status: "IN_PROGRESS" | "READY" | "ERROR";
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
}) {
  return (
    record.status === "READY" &&
    record.definition.trim().length > 0 &&
    record.generalMeaning.trim().length > 0 &&
    record.meaningInContext.trim().length > 0
  );
}

function streamCachedResponse(options: {
  res: NextApiResponse;
  isClosed: () => boolean;
  cached: CachedHighlightRecord;
}): boolean {
  if (!hasReadyAnalysis(options.cached)) {
    return false;
  }

  const normalizedAnalysis = normalizeReaderHighlightAnalysis({
    selectedText: options.cached.selectedText,
    analysis: {
      definition: options.cached.definition,
      generalMeaning: options.cached.generalMeaning,
      meaningInContext: options.cached.meaningInContext,
    },
  });
  streamHighlightId(options.res, options.isClosed(), options.cached.id);
  streamAnalysis(options.res, options.isClosed(), normalizedAnalysis);
  streamDone(options.res, options.isClosed());
  return true;
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

  const highlightId = await upsertHighlight({
    userId,
    articleId: article.id,
    selectedText,
    selectedTextHash,
    selectedOccurrenceIndex,
    occurrenceCount: occurrences.length,
    occurrencesJson: occurrences,
    articleContentHash,
  });
  streamHighlightId(res, isClosed(), highlightId);

  const promptOccurrences = takePromptOccurrences({
    occurrences,
    selectedIndex: selectedOccurrenceIndex,
    maxOccurrences: READER_HIGHLIGHT_MAX_PROMPT_OCCURRENCES,
  });

  const prompt = buildReaderHighlightPrompt({
    articleTitle: article.title,
    selectedText,
    selectedIndex: selectedOccurrenceIndex,
    occurrenceCount: occurrences.length,
    occurrences: promptOccurrences,
  });

  try {
    const generated = await generateStructuredOutput({
      model: "good",
      schema: readerHighlightModelOutputSchema,
      messages: [
        {
          role: "system",
          content:
            "You are a careful Korean reading assistant. Keep output concise, specific, and practical.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    const normalizedAnalysis = normalizeReaderHighlightAnalysis({
      selectedText,
      analysis: generated,
    });

    if (isClosed()) {
      return;
    }

    await markHighlightReady(highlightId, normalizedAnalysis);
    streamAnalysis(res, isClosed(), normalizedAnalysis);
    streamDone(res, isClosed());
  } catch (error) {
    if (isClosed()) {
      return;
    }

    const errorMessage = trimErrorMessage(error);
    await markHighlightError(highlightId, errorMessage);
    streamError(res, isClosed(), errorMessage);
  }
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

  if (cached && streamCachedResponse({ res, isClosed, cached })) {
    return;
  }

  await streamGeneratedResponse({ res, isClosed, resolved });
}
