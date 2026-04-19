import { createHash } from "crypto";
import { z } from "zod";
import type { ReaderHighlightOccurrence } from "./highlight-context";

export const READER_HIGHLIGHT_PROMPT_VERSION = 5;
export const READER_HIGHLIGHT_CONTEXT_RADIUS = 60;
export const READER_HIGHLIGHT_MAX_PROMPT_OCCURRENCES = 25;

export const readerHighlightAnalysisSchema = z.object({
  term: z.string().min(1).max(220),
  definition: z.string().min(1).max(220),
  generalMeaning: z.string().min(1).max(500),
  meaningInContext: z.string().min(1).max(500),
});

export type ReaderHighlightAnalysis = z.infer<
  typeof readerHighlightAnalysisSchema
>;

export const readerHighlightModelOutputSchema = z.object({
  definition: z.string().min(1).max(220),
  generalMeaning: z.string().min(1).max(500),
  meaningInContext: z.string().min(1).max(500),
});

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function renderOccurrence(
  occurrence: ReaderHighlightOccurrence,
  selectedIndex: number,
) {
  const marker = occurrence.index === selectedIndex ? "CURRENT" : "OTHER";

  return [
    `- #${occurrence.index + 1} (${marker})`,
    `  before: ${occurrence.before}`,
    `  match: ${occurrence.match}`,
    `  after: ${occurrence.after}`,
  ].join("\n");
}

export function buildReaderHighlightPrompt(options: {
  articleTitle: string;
  selectedText: string;
  selectedIndex: number;
  occurrenceCount: number;
  occurrences: ReaderHighlightOccurrence[];
}) {
  const {
    articleTitle,
    selectedText,
    selectedIndex,
    occurrenceCount,
    occurrences,
  } = options;

  const occurrenceLines = occurrences
    .map((occurrence) => renderOccurrence(occurrence, selectedIndex))
    .join("\n");

  return [
    `Article title: ${articleTitle}`,
    `INPUT ITEM (Korean phrase): ${selectedText}`,
    `Current occurrence: ${selectedIndex + 1} of ${occurrenceCount}`,
    "",
    "Occurrence contexts:",
    occurrenceLines,
    "",
    "Task:",
    "I want to understand the INPUT ITEM in English.",
    "Use the CURRENT occurrence as the primary meaning and use OTHER occurrences only to disambiguate.",
    "Return concise, practical answers.",
    "",
    "Field requirements:",
    "definition: a short English gloss suitable for the back of a flashcard. Give only one concise gloss, free of caveats parenthesis and semicolons.",
    "generalMeaning: explain the usual meaning or function of the phrase in Korean.",
    "meaningInContext: explain what the phrase means in the CURRENT occurrence and nearby passage.",
    "I am a native English speaker; Explain in English!",
  ].join("\n");
}

function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeReaderHighlightAnalysis(options: {
  selectedText: string;
  analysis: z.infer<typeof readerHighlightModelOutputSchema>;
}): ReaderHighlightAnalysis {
  const term = normalizeInlineText(options.selectedText);

  return {
    term,
    definition: normalizeInlineText(options.analysis.definition),
    generalMeaning: normalizeInlineText(options.analysis.generalMeaning),
    meaningInContext: normalizeInlineText(
      options.analysis.meaningInContext,
    ),
  };
}
