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
import type { NextApiRequest, NextApiResponse } from "next";
import {
  startSSE,
  streamAnalysis,
  streamDone,
  streamError,
  streamHighlightId,
  trackRequestClosed,
  trimStreamErrorMessage,
} from "./highlight-stream-helpers";

type GeneratedAnalysisCallbacks = {
  createInProgressRecord: () => Promise<number>;
  markReady: (
    highlightId: number,
    analysis: ReaderHighlightAnalysis,
  ) => Promise<void>;
  markError: (highlightId: number, message: string) => Promise<void>;
};

type GeneratedAnalysisBaseOptions = {
  res: NextApiResponse;
  isClosed: () => boolean;
  title: string;
};

type GeneratedSelection = {
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrences: ReaderHighlightOccurrence[];
};

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

export async function streamGeneratedAnalysisResponse(
  options: GeneratedAnalysisBaseOptions &
    GeneratedAnalysisCallbacks & {
      selectedText: string;
      selectedOccurrenceIndex: number;
      occurrenceCount: number;
      occurrences: ReaderHighlightOccurrence[];
    },
): Promise<void> {
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

export async function streamGeneratedSelectionResponse(
  options: GeneratedAnalysisBaseOptions &
    GeneratedAnalysisCallbacks & { selection: GeneratedSelection },
): Promise<void> {
  await streamGeneratedAnalysisResponse({
    res: options.res,
    isClosed: options.isClosed,
    title: options.title,
    selectedText: options.selection.selectedText,
    selectedOccurrenceIndex: options.selection.selectedOccurrenceIndex,
    occurrenceCount: options.selection.occurrences.length,
    occurrences: options.selection.occurrences,
    createInProgressRecord: options.createInProgressRecord,
    markReady: options.markReady,
    markError: options.markError,
  });
}

export async function runHighlightAnalysisStream<
  TResolved,
  TCached extends CachedHighlightAnalysisRecord,
>(options: {
  req: NextApiRequest;
  res: NextApiResponse;
  resolve: () => Promise<TResolved | null>;
  loadCached: (resolved: TResolved) => Promise<TCached | null>;
  cachedSelectedText: (cached: TCached) => string;
  streamGenerated: (
    resolved: TResolved,
    isClosed: () => boolean,
  ) => Promise<void>;
}): Promise<void> {
  const resolved = await options.resolve();
  if (!resolved) {
    return;
  }

  const cached = await options.loadCached(resolved);
  startSSE(options.res);
  const isClosed = trackRequestClosed(options.req);

  if (
    cached &&
    streamCachedAnalysisResponse({
      res: options.res,
      isClosed,
      cached,
      selectedText: options.cachedSelectedText(cached),
    })
  ) {
    return;
  }

  await options.streamGenerated(resolved, isClosed);
}
