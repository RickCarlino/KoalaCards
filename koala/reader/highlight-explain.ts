import { createHash } from "crypto";
import type { ReaderHighlightOccurrence } from "./highlight-context";

export const READER_HIGHLIGHT_PROMPT_VERSION = 3;
export const READER_HIGHLIGHT_CONTEXT_RADIUS = 60;
export const READER_HIGHLIGHT_MAX_PROMPT_OCCURRENCES = 25;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function renderOccurrence(
  occurrence: ReaderHighlightOccurrence,
  selectedIndex: number,
): string {
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
}): string {
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
    "You are given a Korean phrase labeled as INPUT ITEM and context from an article.",
    "Generate OUTPUT in English for an English-speaking Korean learner.",
    "Prioritize the CURRENT occurrence, but use OTHER occurrences to disambiguate meaning.",
    "Keep the explanation concise, practical, and specific to this article context.",
    "The OUTPUT must follow this structure exactly, with no numbering or bullets:",
    "Line 1: '[phrase]' is '[English translation]' in English.",
    "",
    "General meaning: explain the usual/general meaning of the phrase.",
    "",
    "Meaning in context: explain how the phrase functions in the CURRENT occurrence and nearby passage.",
    "Do not start with 'The Korean phrase'.",
    "Do not skip any section.",
  ].join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripNumberPrefix(line: string): string {
  return line.replace(/^\s*\d+\s*[.)]?\s*/, "");
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function collapseSpaces(value: string): string {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTranslation(
  normalizedOutput: string,
  selectedText: string,
): string | null {
  const quoted = "['\"“”‘’]";
  const escapedSelectedText = escapeRegExp(selectedText);
  const exactPhraseRegex = new RegExp(
    `(?:The\\s+Korean\\s+phrase\\s+)?${quoted}?${escapedSelectedText}${quoted}?\\s*(?:translates\\s+to|is)\\s*${quoted}([^'"“”‘’]+)${quoted}\\s*in\\s+English`,
    "i",
  );
  const exactPhraseMatch = normalizedOutput.match(exactPhraseRegex);
  if (exactPhraseMatch?.[1]) {
    return exactPhraseMatch[1].trim();
  }

  const genericRegex = new RegExp(
    `(?:translates\\s+to|is)\\s*${quoted}([^'"“”‘’]+)${quoted}\\s*in\\s+English`,
    "i",
  );
  const genericMatch = normalizedOutput.match(genericRegex);
  if (genericMatch?.[1]) {
    return genericMatch[1].trim();
  }

  return null;
}

function extractSection(options: {
  output: string;
  heading: string;
  nextHeading?: string;
}): string | null {
  const { output, heading, nextHeading } = options;
  const escapedHeading = escapeRegExp(heading);
  const escapedNext = nextHeading ? escapeRegExp(nextHeading) : "";
  const pattern = nextHeading
    ? `${escapedHeading}\\s*([\\s\\S]*?)(?=\\n\\s*${escapedNext}|$)`
    : `${escapedHeading}\\s*([\\s\\S]*)$`;

  const match = output.match(new RegExp(pattern, "i"));
  if (!match?.[1]) {
    return null;
  }

  return collapseSpaces(match[1]);
}

function normalizeSectionHeadings(value: string): string {
  return value
    .split("\n")
    .map((line) => stripNumberPrefix(line))
    .join("\n")
    .replace(/^\s*General\s+meaning\s*:/im, "General meaning:")
    .replace(/^\s*Meaning\s+in\s+context\s*:/im, "Meaning in context:");
}

export function normalizeReaderHighlightOutput(options: {
  selectedText: string;
  output: string;
}): string {
  const normalized = collapseSpaces(
    normalizeSectionHeadings(normalizeNewlines(options.output)),
  );
  const generalMeaning = extractSection({
    output: normalized,
    heading: "General meaning:",
    nextHeading: "Meaning in context:",
  });
  const meaningInContext = extractSection({
    output: normalized,
    heading: "Meaning in context:",
  });
  const translation = extractTranslation(normalized, options.selectedText);

  if (!translation || !generalMeaning || !meaningInContext) {
    return normalized;
  }

  return [
    `'${options.selectedText}' is '${translation}' in English.`,
    "",
    `General meaning: ${generalMeaning}`,
    "",
    `Meaning in context: ${meaningInContext}`,
  ].join("\n");
}
