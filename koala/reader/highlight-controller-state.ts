import type {
  ReaderHighlight,
  ReaderHighlightImportResult,
  ReaderHighlightImportStatus,
  ReaderHighlightImportSummary,
} from "./contracts";

export function importableReaderHighlightIds(
  highlights: ReaderHighlight[],
): number[] {
  return highlights
    .filter((highlight) => {
      return (
        highlight.status === "ready" && highlight.importedCardId === null
      );
    })
    .map((highlight) => highlight.id);
}

export function toggleReaderHighlightSelection(options: {
  selectedIds: number[];
  highlightId: number;
  selected: boolean;
}): number[] {
  if (options.selected) {
    return Array.from(
      new Set([...options.selectedIds, options.highlightId]),
    );
  }

  return options.selectedIds.filter((id) => id !== options.highlightId);
}

export function toggleAllReaderHighlights(options: {
  selectedIds: number[];
  importableIds: number[];
}): number[] {
  if (
    options.importableIds.length > 0 &&
    options.importableIds.every((id) => options.selectedIds.includes(id))
  ) {
    return [];
  }

  return [...options.importableIds];
}

export function allReaderHighlightsSelected(options: {
  selectedIds: number[];
  importableIds: number[];
}): boolean {
  return (
    options.importableIds.length > 0 &&
    options.importableIds.every((id) => options.selectedIds.includes(id))
  );
}

export function mergeReaderHighlightImportStatuses(
  current: Record<number, ReaderHighlightImportStatus>,
  results: ReaderHighlightImportResult[],
): Record<number, ReaderHighlightImportStatus> {
  const next = { ...current };
  for (const result of results) {
    next[result.highlightId] = result.status;
  }
  return next;
}

export function readerHighlightImportSummaryMessage(
  summary: ReaderHighlightImportSummary,
): string {
  const parts: string[] = [];
  if (summary.created > 0) {
    parts.push(`${summary.created} added`);
  }
  if (summary.duplicate > 0) {
    parts.push(`${summary.duplicate} duplicate`);
  }
  if (summary.alreadyImported > 0) {
    parts.push(`${summary.alreadyImported} already added`);
  }
  if (summary.notReady > 0) {
    parts.push(`${summary.notReady} not ready`);
  }
  if (summary.missing > 0) {
    parts.push(`${summary.missing} missing`);
  }

  return parts.length > 0 ? parts.join(" · ") : "No changes";
}
