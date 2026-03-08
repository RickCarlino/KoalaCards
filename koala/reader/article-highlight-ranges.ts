import { findOccurrenceOffsets } from "./highlight-context";

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
  const seenSelectedTexts = new Set<string>();
  const offsetsBySelectedText = new Map<
    string,
    Array<{ startOffset: number; endOffset: number }>
  >();

  for (const highlight of highlights) {
    const selectedText = highlight.selectedText.trim();
    if (!selectedText) {
      continue;
    }

    if (seenSelectedTexts.has(selectedText)) {
      continue;
    }
    seenSelectedTexts.add(selectedText);

    const offsets =
      offsetsBySelectedText.get(selectedText) ??
      findOccurrenceOffsets(articleText, selectedText);
    offsetsBySelectedText.set(selectedText, offsets);

    if (offsets.length === 0) {
      continue;
    }

    for (const offset of offsets) {
      if (!isNonEmptyRange(offset)) {
        continue;
      }

      ranges.push({
        highlightId: highlight.id,
        startOffset: offset.startOffset,
        endOffset: offset.endOffset,
      });
    }
  }

  const deduped = dedupeRanges(ranges);
  return removeOverlaps(deduped);
}
