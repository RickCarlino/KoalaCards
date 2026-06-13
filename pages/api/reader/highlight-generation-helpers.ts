import { generateStructuredOutput } from "@/koala/ai";
import {
  takePromptOccurrences,
  type ReaderHighlightOccurrence,
} from "@/koala/reader/highlight-context";
import {
  buildReaderHighlightPrompt,
  normalizeReaderHighlightAnalysis,
  readerHighlightModelOutputSchema,
  READER_HIGHLIGHT_MAX_PROMPT_OCCURRENCES,
  type ReaderHighlightAnalysis,
} from "@/koala/reader/highlight-explain";
import type { NextApiResponse } from "next";
import {
  streamAnalysis,
  streamDone,
  streamError,
  streamHighlightId,
  trimStreamErrorMessage,
} from "./highlight-stream-helpers";

export type CachedHighlightAnalysisRecord = {
  id: number;
  status: "IN_PROGRESS" | "READY" | "ERROR";
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
};

function hasReadyAnalysis(record: CachedHighlightAnalysisRecord): boolean {
  return (
    record.status === "READY" &&
    record.definition.trim().length > 0 &&
    record.generalMeaning.trim().length > 0 &&
    record.meaningInContext.trim().length > 0
  );
}

export function streamCachedAnalysisResponse(options: {
  res: NextApiResponse;
  isClosed: () => boolean;
  cached: CachedHighlightAnalysisRecord;
  selectedText: string;
}): boolean {
  if (!hasReadyAnalysis(options.cached)) {
    return false;
  }

  const normalizedAnalysis = normalizeReaderHighlightAnalysis({
    selectedText: options.selectedText,
    analysis: {
      definition: options.cached.definition,
      generalMeaning: options.cached.generalMeaning,
      meaningInContext: options.cached.meaningInContext,
    },
  });
  streamHighlightId({
    res: options.res,
    isClosed: options.isClosed(),
    highlightId: options.cached.id,
  });
  streamAnalysis({
    res: options.res,
    isClosed: options.isClosed(),
    analysis: normalizedAnalysis,
  });
  streamDone(options.res, options.isClosed());
  return true;
}

export async function streamGeneratedAnalysisResponse(options: {
  res: NextApiResponse;
  isClosed: () => boolean;
  title: string;
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrenceCount: number;
  occurrences: ReaderHighlightOccurrence[];
  createInProgressRecord: () => Promise<number>;
  markReady: (
    highlightId: number,
    analysis: ReaderHighlightAnalysis,
  ) => Promise<void>;
  markError: (highlightId: number, message: string) => Promise<void>;
}): Promise<void> {
  const highlightId = await options.createInProgressRecord();
  streamHighlightId({
    res: options.res,
    isClosed: options.isClosed(),
    highlightId,
  });

  const promptOccurrences = takePromptOccurrences({
    occurrences: options.occurrences,
    selectedIndex: options.selectedOccurrenceIndex,
    maxOccurrences: READER_HIGHLIGHT_MAX_PROMPT_OCCURRENCES,
  });

  const prompt = buildReaderHighlightPrompt({
    articleTitle: options.title,
    selectedText: options.selectedText,
    selectedIndex: options.selectedOccurrenceIndex,
    occurrenceCount: options.occurrenceCount,
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
      selectedText: options.selectedText,
      analysis: generated,
    });

    if (options.isClosed()) {
      return;
    }

    await options.markReady(highlightId, normalizedAnalysis);
    streamAnalysis({
      res: options.res,
      isClosed: options.isClosed(),
      analysis: normalizedAnalysis,
    });
    streamDone(options.res, options.isClosed());
  } catch (error) {
    if (options.isClosed()) {
      return;
    }

    const errorMessage = trimStreamErrorMessage(error);
    await options.markError(highlightId, errorMessage);
    streamError({
      res: options.res,
      isClosed: options.isClosed(),
      message: errorMessage,
    });
  }
}
