export type HighlightSnippet = {
  keyword: string;
  snippet: string;
};

type HighlightOccurrence = {
  before: string;
  match: string;
  after: string;
};

function parseHighlightOccurrences(value: unknown): HighlightOccurrence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: HighlightOccurrence[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const maybeBefore = (item as { before?: unknown }).before;
    const maybeMatch = (item as { match?: unknown }).match;
    const maybeAfter = (item as { after?: unknown }).after;

    if (
      typeof maybeBefore !== "string" ||
      typeof maybeMatch !== "string" ||
      typeof maybeAfter !== "string"
    ) {
      continue;
    }

    parsed.push({
      before: maybeBefore,
      match: maybeMatch,
      after: maybeAfter,
    });
  }

  return parsed;
}

function normalizeSnippetChunk(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeHighlightText(value: string): string {
  return value.trim();
}

function normalizeSelectedOccurrence(
  selectedOccurrence: HighlightOccurrence | null,
  selectedText: string,
): HighlightOccurrence {
  if (!selectedOccurrence) {
    return {
      before: "",
      match: normalizeSnippetChunk(selectedText),
      after: "",
    };
  }

  return {
    before: normalizeSnippetChunk(selectedOccurrence.before),
    match: normalizeSnippetChunk(selectedOccurrence.match),
    after: normalizeSnippetChunk(selectedOccurrence.after),
  };
}

export function buildHighlightSnippet(options: {
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrencesJson: unknown;
}): HighlightSnippet | null {
  const occurrences = parseHighlightOccurrences(options.occurrencesJson);
  const selectedOccurrence =
    occurrences[options.selectedOccurrenceIndex] ?? null;
  const { before, match, after } = normalizeSelectedOccurrence(
    selectedOccurrence,
    options.selectedText,
  );

  if (match.length === 0) {
    return null;
  }

  const wrappedMatch = `{{ ${match} }}`;

  if (before.length === 0 && after.length === 0) {
    return {
      keyword: match,
      snippet: wrappedMatch,
    };
  }

  const prefix = before.length > 0 ? `...${before} ` : "";
  const suffix = after.length > 0 ? ` ${after}...` : "";
  return {
    keyword: match,
    snippet: `${prefix}${wrappedMatch}${suffix}`.trim(),
  };
}
