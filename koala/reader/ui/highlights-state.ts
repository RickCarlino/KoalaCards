export type ReaderHighlightAnalysisLike = {
  term: string;
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
};

export type ReaderArticleHighlightLike = ReaderHighlightAnalysisLike & {
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrenceCount: number;
  status: "in_progress" | "ready" | "error";
  errorMessage: string;
  contextBefore: string;
  contextAfter: string;
  importedCardId: number | null;
  createdAt: Date;
};

export type HighlightImportResultStatusLike =
  | "created"
  | "duplicate"
  | "already_imported"
  | "not_ready"
  | "missing";

export type ContextSummaryParts = {
  before: string;
  match: string;
  after: string;
};

export type HighlightBadgeMeta = {
  label: string;
  color: string;
};

function normalizeContextChunk(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function compactContextSummary(
  highlight: ReaderArticleHighlightLike,
): ContextSummaryParts {
  const maxTotalLength = 200;
  const match = normalizeContextChunk(highlight.selectedText);
  if (!match) {
    return {
      before: "",
      match: "",
      after: "",
    };
  }

  if (match.length >= maxTotalLength) {
    return {
      before: "",
      match: `${match.slice(0, maxTotalLength - 3)}...`,
      after: "",
    };
  }

  let before = normalizeContextChunk(highlight.contextBefore);
  let after = normalizeContextChunk(highlight.contextAfter);
  const availableContext = maxTotalLength - match.length;
  const beforeLimit = Math.floor(availableContext / 2);
  const afterLimit = availableContext - beforeLimit;

  if (before.length > beforeLimit) {
    const tailLength = Math.max(0, beforeLimit - 3);
    before = tailLength > 0 ? `...${before.slice(-tailLength)}` : "";
  }

  if (after.length > afterLimit) {
    const headLength = Math.max(0, afterLimit - 3);
    after = headLength > 0 ? `${after.slice(0, headLength)}...` : "";
  }

  return {
    before,
    match,
    after,
  };
}

function formatHighlightTimestamp(value: Date): string {
  try {
    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function buildHighlightMetaLine(
  highlight: ReaderArticleHighlightLike,
  timestamp: string,
): string {
  const occurrenceText = `Occurrence ${highlight.selectedOccurrenceIndex + 1} of ${highlight.occurrenceCount}`;
  if (!timestamp) {
    return occurrenceText;
  }

  return `${occurrenceText} • ${timestamp}`;
}

export function hasAnalysis(
  analysis: ReaderHighlightAnalysisLike | null,
): boolean {
  if (!analysis) {
    return false;
  }

  return (
    analysis.definition.trim().length > 0 &&
    analysis.generalMeaning.trim().length > 0 &&
    analysis.meaningInContext.trim().length > 0
  );
}

export function formatAnalysisAsExplanation(
  analysis: ReaderHighlightAnalysisLike,
): string {
  return [
    `${analysis.term}: ${analysis.definition}`,
    "",
    analysis.generalMeaning,
    "",
    analysis.meaningInContext,
  ].join("\n");
}

export function resolveExplainActionState(options: {
  onAddToDeck?: () => void;
  canAddToDeck: boolean;
  isExplaining: boolean;
  isDeletingHighlight: boolean;
  isAddingToDeck: boolean;
  canDeleteHighlight: boolean;
  onDeleteHighlight?: () => void;
}) {
  return {
    showAddAction: Boolean(options.onAddToDeck),
    showDeleteAction: Boolean(options.onDeleteHighlight),
    addDisabled:
      !options.canAddToDeck ||
      options.isExplaining ||
      options.isDeletingHighlight,
    deleteDisabled:
      !options.canDeleteHighlight ||
      options.isDeletingHighlight ||
      options.isExplaining,
    isAddingToDeck: options.isAddingToDeck,
    isDeletingHighlight: options.isDeletingHighlight,
  };
}

export function resolveHighlightBadgeMeta(
  highlight: ReaderArticleHighlightLike,
  importStatus: HighlightImportResultStatusLike | null,
): HighlightBadgeMeta | null {
  if (highlight.importedCardId !== null) {
    return { label: "Added", color: "teal" };
  }

  if (importStatus === "created" || importStatus === "already_imported") {
    return { label: "Added", color: "teal" };
  }

  if (importStatus === "duplicate") {
    return { label: "Duplicate", color: "gray" };
  }

  if (importStatus === "not_ready") {
    return { label: "Not ready", color: "yellow" };
  }

  if (highlight.status === "in_progress") {
    return { label: "Pending", color: "yellow" };
  }

  if (highlight.status === "error") {
    return { label: "Error", color: "red" };
  }

  return null;
}

export function resolveHighlightRowState(
  highlight: ReaderArticleHighlightLike,
  importStatus: HighlightImportResultStatusLike | null,
  showExplanation: boolean,
) {
  const contextSummary = compactContextSummary(highlight);
  const analysis = {
    term: highlight.term,
    definition: highlight.definition,
    generalMeaning: highlight.generalMeaning,
    meaningInContext: highlight.meaningInContext,
  };
  const highlightHasAnalysis =
    highlight.status === "ready" && hasAnalysis(analysis);

  return {
    analysis,
    badgeMeta: resolveHighlightBadgeMeta(highlight, importStatus),
    canSelect:
      highlight.status === "ready" && highlight.importedCardId === null,
    contextSummary,
    hasContextSummary:
      contextSummary.before.length > 0 ||
      contextSummary.match.length > 0 ||
      contextSummary.after.length > 0,
    highlightHasAnalysis,
    metaLine: buildHighlightMetaLine(
      highlight,
      formatHighlightTimestamp(highlight.createdAt),
    ),
    showErrorMessage:
      highlight.status === "error" &&
      highlight.errorMessage.trim().length > 0,
    toggleLabel: showExplanation ? "Hide explanation" : "Show explanation",
  };
}

export function resolveHighlightsVisibility<T>(
  highlights: T[],
  showAll: boolean,
) {
  const visibleHighlights = showAll ? highlights : highlights.slice(0, 4);
  const hiddenCount = highlights.length - visibleHighlights.length;

  return {
    visibleHighlights,
    hiddenCount,
    canExpand: hiddenCount > 0,
    canCollapse: showAll && highlights.length > 4,
  };
}

export function resolveHighlightsHistoryState(options: {
  isLoading: boolean;
  errorMessage: string;
  highlightCount: number;
}) {
  const hasError = options.errorMessage.trim().length > 0;

  return {
    showError: !options.isLoading && hasError,
    showEmpty:
      !options.isLoading && !hasError && options.highlightCount === 0,
    showList: !options.isLoading && options.highlightCount > 0,
  };
}
