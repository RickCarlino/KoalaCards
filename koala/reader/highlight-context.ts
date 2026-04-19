export type ReaderHighlightOccurrence = {
  index: number;
  startOffset: number;
  endOffset: number;
  before: string;
  match: string;
  after: string;
};

const WHITESPACE_RE = /\s+/g;

function normalizeWhitespace(value: string): string {
  return value.replace(WHITESPACE_RE, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function commonPrefixLength(left: string, right: string): number {
  const maxLength = Math.min(left.length, right.length);
  let matched = 0;

  while (matched < maxLength && left[matched] === right[matched]) {
    matched += 1;
  }

  return matched;
}

function commonSuffixLength(left: string, right: string): number {
  const leftLength = left.length;
  const rightLength = right.length;
  const maxLength = Math.min(leftLength, rightLength);
  let matched = 0;

  while (
    matched < maxLength &&
    left[leftLength - 1 - matched] === right[rightLength - 1 - matched]
  ) {
    matched += 1;
  }

  return matched;
}

function findOverlappingSubstringOffsets(
  text: string,
  phrase: string,
): Array<{ startOffset: number; endOffset: number }> {
  if (!phrase) {
    return [];
  }

  const offsets: Array<{ startOffset: number; endOffset: number }> = [];
  let cursor = 0;

  while (cursor <= text.length - phrase.length) {
    const matchIndex = text.indexOf(phrase, cursor);
    if (matchIndex < 0) {
      break;
    }

    offsets.push({
      startOffset: matchIndex,
      endOffset: matchIndex + phrase.length,
    });
    cursor = matchIndex + 1;
  }

  return offsets;
}

function findWhitespaceFlexibleOffsets(
  text: string,
  phrase: string,
): Array<{ startOffset: number; endOffset: number }> {
  const normalized = normalizeWhitespace(phrase);
  if (!normalized) {
    return [];
  }

  const tokens = normalized.split(" ").filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return [];
  }

  const pattern = tokens
    .map((token) => escapeRegExp(token))
    .join("\\\\s+");
  const regex = new RegExp(`(?=(${pattern}))`, "g");
  const offsets: Array<{ startOffset: number; endOffset: number }> = [];

  let match = regex.exec(text);
  while (match) {
    const matchedValue = match[1];
    offsets.push({
      startOffset: match.index,
      endOffset: match.index + matchedValue.length,
    });

    regex.lastIndex = match.index + 1;
    match = regex.exec(text);
  }

  return offsets;
}

function dedupeAndSortOffsets(
  offsets: Array<{ startOffset: number; endOffset: number }>,
): Array<{ startOffset: number; endOffset: number }> {
  const uniqueByRange = new Map<
    string,
    {
      startOffset: number;
      endOffset: number;
    }
  >();

  for (const offset of offsets) {
    const key = `${offset.startOffset}:${offset.endOffset}`;
    if (!uniqueByRange.has(key)) {
      uniqueByRange.set(key, offset);
    }
  }

  return [...uniqueByRange.values()].sort((left, right) => {
    if (left.startOffset !== right.startOffset) {
      return left.startOffset - right.startOffset;
    }

    return left.endOffset - right.endOffset;
  });
}

export function findOccurrenceOffsets(
  text: string,
  selectedText: string,
): Array<{ startOffset: number; endOffset: number }> {
  const phrase = selectedText.trim();
  if (!phrase) {
    return [];
  }

  const exactMatches = findOverlappingSubstringOffsets(text, phrase);
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  if (!/\s/.test(phrase)) {
    return [];
  }

  const flexibleMatches = findWhitespaceFlexibleOffsets(text, phrase);
  return dedupeAndSortOffsets(flexibleMatches);
}

export function buildOccurrenceContexts(
  text: string,
  selectedText: string,
  contextRadius: number,
): ReaderHighlightOccurrence[] {
  const offsets = findOccurrenceOffsets(text, selectedText);
  const radius = Math.max(0, contextRadius);

  return offsets.map((offset, index) => {
    const beforeStart = Math.max(0, offset.startOffset - radius);
    const afterEnd = Math.min(text.length, offset.endOffset + radius);

    return {
      index,
      startOffset: offset.startOffset,
      endOffset: offset.endOffset,
      before: text.slice(beforeStart, offset.startOffset),
      match: text.slice(offset.startOffset, offset.endOffset),
      after: text.slice(offset.endOffset, afterEnd),
    };
  });
}

function scoreOccurrence(
  occurrence: ReaderHighlightOccurrence,
  contextBefore: string,
  contextAfter: string,
): number {
  const normalizedCandidateBefore = normalizeWhitespace(occurrence.before);
  const normalizedCandidateAfter = normalizeWhitespace(occurrence.after);
  const normalizedBefore = normalizeWhitespace(contextBefore);
  const normalizedAfter = normalizeWhitespace(contextAfter);

  const suffixScore = commonSuffixLength(
    normalizedCandidateBefore,
    normalizedBefore,
  );
  const prefixScore = commonPrefixLength(
    normalizedCandidateAfter,
    normalizedAfter,
  );

  return suffixScore + prefixScore;
}

function hasValidOccurrenceHint(
  occurrenceHint: number | undefined,
  occurrenceCount: number,
): occurrenceHint is number {
  return (
    typeof occurrenceHint === "number" &&
    Number.isInteger(occurrenceHint) &&
    occurrenceHint >= 0 &&
    occurrenceHint < occurrenceCount
  );
}

function shouldPreferOccurrenceByHint(options: {
  score: number;
  bestScore: number;
  occurrenceIndex: number;
  bestIndex: number;
  occurrenceHint: number;
}): boolean {
  if (options.score !== options.bestScore) {
    return false;
  }

  const currentDistance = Math.abs(
    options.occurrenceIndex - options.occurrenceHint,
  );
  const bestDistance = Math.abs(
    options.bestIndex - options.occurrenceHint,
  );
  return currentDistance < bestDistance;
}

export function selectOccurrenceIndex(options: {
  occurrences: ReaderHighlightOccurrence[];
  contextBefore: string;
  contextAfter: string;
  occurrenceHint?: number;
}): number {
  const { occurrences, contextBefore, contextAfter, occurrenceHint } =
    options;

  if (occurrences.length === 0) {
    return -1;
  }

  if (occurrences.length === 1) {
    return 0;
  }

  const hasValidHint = hasValidOccurrenceHint(
    occurrenceHint,
    occurrences.length,
  );

  let bestIndex = 0;
  let bestScore = -1;

  for (const occurrence of occurrences) {
    const score = scoreOccurrence(occurrence, contextBefore, contextAfter);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = occurrence.index;
      continue;
    }

    if (
      hasValidHint &&
      shouldPreferOccurrenceByHint({
        score,
        bestScore,
        occurrenceIndex: occurrence.index,
        bestIndex,
        occurrenceHint,
      })
    ) {
      bestIndex = occurrence.index;
    }
  }

  if (bestScore === 0 && hasValidHint) {
    return occurrenceHint;
  }

  return bestIndex;
}

export function takePromptOccurrences(options: {
  occurrences: ReaderHighlightOccurrence[];
  selectedIndex: number;
  maxOccurrences: number;
}): ReaderHighlightOccurrence[] {
  const { occurrences, selectedIndex, maxOccurrences } = options;
  if (occurrences.length <= maxOccurrences) {
    return occurrences;
  }

  const selected = occurrences[selectedIndex];
  if (!selected) {
    return occurrences.slice(0, maxOccurrences);
  }

  const sortedByDistance = [...occurrences].sort((left, right) => {
    const leftDistance = Math.abs(left.index - selectedIndex);
    const rightDistance = Math.abs(right.index - selectedIndex);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return left.index - right.index;
  });

  const subset = sortedByDistance.slice(0, maxOccurrences);
  return subset.sort((left, right) => left.index - right.index);
}
