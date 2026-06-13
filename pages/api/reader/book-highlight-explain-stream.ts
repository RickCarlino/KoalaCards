import { prismaClient } from "@/koala/prisma-client";
import { readerBookLocatorSchema } from "@/koala/reader/book";
import { Prisma } from "@prisma/client";
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
  sectionText: z.string().min(1).max(80000),
  locatorJson: readerBookLocatorSchema,
  epubCfi: z.string().trim().max(1000).optional(),
  chapterTitle: z.string().trim().max(500).optional(),
  progression: z.number().min(0).max(1).optional(),
});

type StreamRequestBody = z.infer<typeof bodySchema>;

type CachedAnnotationRecord = {
  id: number;
  status: "IN_PROGRESS" | "READY" | "ERROR";
  quote: string;
  term: string;
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
};

type OwnedBookRecord = {
  id: number;
  title: string;
};

type ResolvedExplainRequest = {
  userId: string;
  book: OwnedBookRecord;
  selectedText: string;
  selectedTextHash: string;
  sectionTextHash: string;
  selectedOccurrenceIndex: number;
  locatorJson: StreamRequestBody["locatorJson"];
  epubCfi: string | null;
  chapterTitle: string;
  progression: number;
  occurrences: Array<{
    index: number;
    startOffset: number;
    endOffset: number;
    before: string;
    match: string;
    after: string;
  }>;
};

type ResolvedSelectionOccurrences = {
  sectionText: string;
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrences: ResolvedExplainRequest["occurrences"];
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeSectionText(value: string): string {
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

async function requireOwnedBook(
  publicId: string,
  userId: string,
  res: NextApiResponse,
): Promise<OwnedBookRecord | null> {
  const book = await prismaClient.readerBook.findUnique({
    where: { publicId },
    select: {
      id: true,
      userId: true,
      title: true,
    },
  });

  if (!book) {
    res.status(404).end("Book not found.");
    return null;
  }

  if (book.userId !== userId) {
    res.status(403).end("Forbidden");
    return null;
  }

  return {
    id: book.id,
    title: book.title,
  };
}

async function loadCachedAnnotation(options: {
  userId: string;
  bookId: number;
  selectedTextHash: string;
  selectedOccurrenceIndex: number;
  sectionTextHash: string;
}): Promise<CachedAnnotationRecord | null> {
  return prismaClient.readerBookAnnotation.findUnique({
    where: {
      userId_bookId_selectedTextHash_selectedOccurrenceIndex_sectionTextHash_promptVersion:
        {
          userId: options.userId,
          bookId: options.bookId,
          selectedTextHash: options.selectedTextHash,
          selectedOccurrenceIndex: options.selectedOccurrenceIndex,
          sectionTextHash: options.sectionTextHash,
          promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
        },
    },
    select: {
      id: true,
      status: true,
      quote: true,
      term: true,
      definition: true,
      generalMeaning: true,
      meaningInContext: true,
    },
  });
}

async function upsertAnnotation(options: {
  userId: string;
  bookId: number;
  locatorJson: StreamRequestBody["locatorJson"];
  epubCfi: string | null;
  chapterTitle: string;
  progression: number;
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
  sectionTextHash: string;
}): Promise<number> {
  const currentOccurrence =
    options.occurrencesJson[options.selectedOccurrenceIndex] ?? null;
  const record = await prismaClient.readerBookAnnotation.upsert({
    where: {
      userId_bookId_selectedTextHash_selectedOccurrenceIndex_sectionTextHash_promptVersion:
        {
          userId: options.userId,
          bookId: options.bookId,
          selectedTextHash: options.selectedTextHash,
          selectedOccurrenceIndex: options.selectedOccurrenceIndex,
          sectionTextHash: options.sectionTextHash,
          promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
        },
    },
    create: {
      userId: options.userId,
      bookId: options.bookId,
      locatorJson: toPrismaJson(options.locatorJson),
      epubCfi: options.epubCfi,
      chapterTitle: options.chapterTitle,
      progression: options.progression,
      quote: options.selectedText,
      contextBefore: currentOccurrence?.before ?? "",
      contextAfter: currentOccurrence?.after ?? "",
      selectedTextHash: options.selectedTextHash,
      selectedOccurrenceIndex: options.selectedOccurrenceIndex,
      occurrenceCount: options.occurrenceCount,
      occurrencesJson: toPrismaJson(options.occurrencesJson),
      sectionTextHash: options.sectionTextHash,
      promptVersion: READER_HIGHLIGHT_PROMPT_VERSION,
      status: "IN_PROGRESS",
      term: "",
      definition: "",
      generalMeaning: "",
      meaningInContext: "",
      errorMessage: "",
    },
    update: {
      locatorJson: toPrismaJson(options.locatorJson),
      epubCfi: options.epubCfi,
      chapterTitle: options.chapterTitle,
      progression: options.progression,
      quote: options.selectedText,
      contextBefore: currentOccurrence?.before ?? "",
      contextAfter: currentOccurrence?.after ?? "",
      selectedOccurrenceIndex: options.selectedOccurrenceIndex,
      occurrenceCount: options.occurrenceCount,
      occurrencesJson: toPrismaJson(options.occurrencesJson),
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

async function markAnnotationReady(
  annotationId: number,
  analysis: ReaderHighlightAnalysis,
): Promise<void> {
  await prismaClient.readerBookAnnotation.update({
    where: { id: annotationId },
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

async function markAnnotationError(
  annotationId: number,
  message: string,
): Promise<void> {
  await prismaClient.readerBookAnnotation.update({
    where: { id: annotationId },
    data: {
      status: "ERROR",
      errorMessage: message,
    },
  });
}

function requireOpenAiKey(res: NextApiResponse): boolean {
  if (process.env.OPENAI_API_KEY) {
    return true;
  }

  res.status(500).end("Missing OPENAI_API_KEY");
  return false;
}

async function resolveAuthorizedBook(
  req: NextApiRequest,
  res: NextApiResponse,
  publicId: string,
): Promise<{ userId: string; book: OwnedBookRecord } | null> {
  const userId = await requireReaderApiUserId(req, res);
  if (!userId) {
    return null;
  }

  const book = await requireOwnedBook(publicId, userId, res);
  if (!book) {
    return null;
  }

  return { userId, book };
}

function resolveSelectionOccurrences(
  parsedBody: StreamRequestBody,
  res: NextApiResponse,
): ResolvedSelectionOccurrences | null {
  const sectionText = normalizeSectionText(parsedBody.sectionText);
  const selectedText = parsedBody.selectedText.trim();
  const occurrences = buildOccurrenceContexts(
    sectionText,
    selectedText,
    READER_HIGHLIGHT_CONTEXT_RADIUS,
  );

  if (occurrences.length === 0) {
    res.status(400).end("Selected text was not found in this section.");
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
    sectionText,
    selectedText,
    selectedOccurrenceIndex,
    occurrences,
  };
}

function buildResolvedExplainRequest(options: {
  parsedBody: StreamRequestBody;
  authorized: { userId: string; book: OwnedBookRecord };
  resolvedSelection: ResolvedSelectionOccurrences;
}): ResolvedExplainRequest {
  const { parsedBody, authorized, resolvedSelection } = options;

  return {
    userId: authorized.userId,
    book: authorized.book,
    selectedText: resolvedSelection.selectedText,
    selectedTextHash: sha256Hex(resolvedSelection.selectedText),
    sectionTextHash: sha256Hex(resolvedSelection.sectionText),
    selectedOccurrenceIndex: resolvedSelection.selectedOccurrenceIndex,
    locatorJson: parsedBody.locatorJson,
    epubCfi: parsedBody.epubCfi ?? null,
    chapterTitle:
      parsedBody.chapterTitle ??
      parsedBody.locatorJson.chapterTitle ??
      parsedBody.locatorJson.title ??
      "",
    progression:
      parsedBody.progression ??
      parsedBody.locatorJson.totalProgression ??
      parsedBody.locatorJson.progression ??
      0,
    occurrences: resolvedSelection.occurrences,
  };
}

async function resolveExplainRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<ResolvedExplainRequest | null> {
  if (!requirePostMethod(req, res) || !requireOpenAiKey(res)) {
    return null;
  }

  const parsedBody = parseBody(req, res);
  if (!parsedBody) {
    return null;
  }

  const authorized = await resolveAuthorizedBook(
    req,
    res,
    parsedBody.publicId,
  );
  if (!authorized) {
    return null;
  }

  const resolvedSelection = resolveSelectionOccurrences(parsedBody, res);
  if (!resolvedSelection) {
    return null;
  }

  return buildResolvedExplainRequest({
    parsedBody,
    authorized,
    resolvedSelection,
  });
}

async function streamGeneratedResponse(options: {
  res: NextApiResponse;
  isClosed: () => boolean;
  resolved: ResolvedExplainRequest;
}): Promise<void> {
  const {
    resolved: {
      userId,
      book,
      selectedText,
      selectedTextHash,
      sectionTextHash,
      selectedOccurrenceIndex,
      locatorJson,
      epubCfi,
      chapterTitle,
      progression,
      occurrences,
    },
    res,
    isClosed,
  } = options;

  await streamGeneratedAnalysisResponse({
    res,
    isClosed,
    title: chapterTitle ? `${book.title} - ${chapterTitle}` : book.title,
    selectedText,
    selectedOccurrenceIndex,
    occurrenceCount: occurrences.length,
    occurrences,
    createInProgressRecord: () =>
      upsertAnnotation({
        userId,
        bookId: book.id,
        locatorJson,
        epubCfi,
        chapterTitle,
        progression,
        selectedText,
        selectedTextHash,
        selectedOccurrenceIndex,
        occurrenceCount: occurrences.length,
        occurrencesJson: occurrences,
        sectionTextHash,
      }),
    markReady: markAnnotationReady,
    markError: markAnnotationError,
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

  const cached = await loadCachedAnnotation({
    userId: resolved.userId,
    bookId: resolved.book.id,
    selectedTextHash: resolved.selectedTextHash,
    selectedOccurrenceIndex: resolved.selectedOccurrenceIndex,
    sectionTextHash: resolved.sectionTextHash,
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
      selectedText: cached.quote,
    })
  ) {
    return;
  }

  await streamGeneratedResponse({ res, isClosed, resolved });
}
