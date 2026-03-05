import {
  buildOccurrenceContexts,
  selectOccurrenceIndex,
} from "./highlight-context";

export type SavedArticleHighlightForRender = {
  id: number;
  selectedText: string;
  selectedOccurrenceIndex: number;
  contextBefore: string;
  contextAfter: string;
};

export type ArticleHighlightRange = {
  highlightId: number;
  startOffset: number;
  endOffset: number;
};

const RENDER_CONTEXT_RADIUS = 80;

function clampIndex(value: number, length: number): number {
  if (length <= 0) {
    return -1;
  }

  if (value < 0) {
    return 0;
  }

  if (value >= length) {
    return length - 1;
  }

  return value;
}

function isNonEmptyRange(range: {
  startOffset: number;
  endOffset: number;
}): boolean {
  return range.endOffset > range.startOffset;
}

function dedupeRanges(
  ranges: ArticleHighlightRange[],
): ArticleHighlightRange[] {
  const deduped = new Map<string, ArticleHighlightRange>();
  for (const range of ranges) {
    const key = `${range.startOffset}:${range.endOffset}`;
    if (!deduped.has(key)) {
      deduped.set(key, range);
    }
  }

  return [...deduped.values()].sort((left, right) => {
    if (left.startOffset !== right.startOffset) {
      return left.startOffset - right.startOffset;
    }

    return left.endOffset - right.endOffset;
  });
}

function removeOverlaps(
  ranges: ArticleHighlightRange[],
): ArticleHighlightRange[] {
  if (ranges.length <= 1) {
    return ranges;
  }

  const resolved: ArticleHighlightRange[] = [];
  let previousEnd = -1;

  for (const range of ranges) {
    if (range.startOffset < previousEnd) {
      continue;
    }

    resolved.push(range);
    previousEnd = range.endOffset;
  }

  return resolved;
}

export function buildSavedArticleHighlightRanges(options: {
  articleText: string;
  highlights: SavedArticleHighlightForRender[];
}): ArticleHighlightRange[] {
  const { articleText, highlights } = options;
  if (!articleText || highlights.length === 0) {
    return [];
  }

  const ranges: ArticleHighlightRange[] = [];

  for (const highlight of highlights) {
    const occurrences = buildOccurrenceContexts(
      articleText,
      highlight.selectedText,
      RENDER_CONTEXT_RADIUS,
    );
    if (occurrences.length === 0) {
      continue;
    }

    const resolvedIndex = selectOccurrenceIndex({
      occurrences,
      contextBefore: highlight.contextBefore,
      contextAfter: highlight.contextAfter,
      occurrenceHint: highlight.selectedOccurrenceIndex,
    });
    const fallbackIndex = clampIndex(
      highlight.selectedOccurrenceIndex,
      occurrences.length,
    );

    const selectedOccurrence =
      occurrences[resolvedIndex] ?? occurrences[fallbackIndex];
    if (!selectedOccurrence) {
      continue;
    }

    if (!isNonEmptyRange(selectedOccurrence)) {
      continue;
    }

    ranges.push({
      highlightId: highlight.id,
      startOffset: selectedOccurrence.startOffset,
      endOffset: selectedOccurrence.endOffset,
    });
  }

  const deduped = dedupeRanges(ranges);
  return removeOverlaps(deduped);
}
