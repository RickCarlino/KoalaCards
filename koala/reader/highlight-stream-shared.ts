import { NextApiResponse } from "next";
import { z } from "zod";
import {
  buildOccurrenceContexts,
  selectOccurrenceIndex,
} from "@/koala/reader/highlight-context";
import {
  READER_HIGHLIGHT_CONTEXT_RADIUS,
  type ReaderHighlightAnalysis,
} from "@/koala/reader/highlight-explain";

export const baseHighlightStreamBodySchema = z.object({
  publicId: z.string().trim().min(1),
  selectedText: z.string().trim().min(1).max(220),
  contextBefore: z.string().max(260).optional(),
  contextAfter: z.string().max(260).optional(),
  occurrenceHint: z.number().int().min(0).optional(),
});

type HighlightBodySelection = {
  contextAfter?: string;
  contextBefore?: string;
  occurrenceHint?: number;
  selectedText: string;
};

export type HighlightOccurrenceRecord = {
  after: string;
  before: string;
  endOffset: number;
  index: number;
  match: string;
  startOffset: number;
};

export type ResolvedHighlightSelection = {
  occurrences: HighlightOccurrenceRecord[];
  selectedOccurrenceIndex: number;
  selectedText: string;
  sourceText: string;
};

export function normalizeHighlightSourceText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function parseHighlightStreamBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
  res: NextApiResponse,
): T | null {
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    return parsed.data;
  }

  res.status(400).end("Invalid request body.");
  return null;
}

export function resolveHighlightSelection(options: {
  body: HighlightBodySelection;
  missingMessage: string;
  res: NextApiResponse;
  sourceText: string;
}): ResolvedHighlightSelection | null {
  const sourceText = normalizeHighlightSourceText(options.sourceText);
  const selectedText = options.body.selectedText.trim();
  const occurrences = buildOccurrenceContexts(
    sourceText,
    selectedText,
    READER_HIGHLIGHT_CONTEXT_RADIUS,
  );

  if (occurrences.length === 0) {
    options.res.status(400).end(options.missingMessage);
    return null;
  }

  const selectedOccurrenceIndex = selectOccurrenceIndex({
    occurrences,
    contextBefore: options.body.contextBefore ?? "",
    contextAfter: options.body.contextAfter ?? "",
    occurrenceHint: options.body.occurrenceHint,
  });

  if (selectedOccurrenceIndex < 0) {
    options.res.status(400).end("Could not resolve selected occurrence.");
    return null;
  }

  return {
    sourceText,
    selectedText,
    selectedOccurrenceIndex,
    occurrences,
  };
}

export function inProgressAnalysisData() {
  return {
    status: "IN_PROGRESS" as const,
    term: "",
    definition: "",
    generalMeaning: "",
    meaningInContext: "",
    errorMessage: "",
  };
}

export function readyAnalysisData(analysis: ReaderHighlightAnalysis) {
  return {
    status: "READY" as const,
    term: analysis.term,
    definition: analysis.definition,
    generalMeaning: analysis.generalMeaning,
    meaningInContext: analysis.meaningInContext,
    errorMessage: "",
  };
}

export function errorAnalysisData(message: string) {
  return {
    status: "ERROR" as const,
    errorMessage: message,
  };
}
