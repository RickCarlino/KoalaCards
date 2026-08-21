import type { ReaderBookLocator } from "./book";

export const READER_AUTO_EXPLAIN_MAX_LENGTH = 80;

export type ReaderResourceKind = "article" | "book";

export type ReaderResource = {
  kind: ReaderResourceKind;
  publicId: string;
};

export type ReaderArticleLocation = {
  kind: "article";
  occurrenceIndex: number;
};

export type ReaderBookLocation = {
  kind: "book";
  locator: ReaderBookLocator;
  chapterTitle: string;
  progression: number;
};

export type ReaderSavedLocation =
  | ReaderArticleLocation
  | ReaderBookLocation;

export type ReaderArticleSourceContext = {
  kind: "article";
};

export type ReaderBookSourceContext = {
  kind: "book";
  sectionText: string;
};

export type ReaderSelectionSourceContext =
  | ReaderArticleSourceContext
  | ReaderBookSourceContext;

export type ReaderSelectionDraft = {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  occurrenceHint: number;
  location: ReaderSavedLocation;
  sourceContext: ReaderSelectionSourceContext;
};

export type ReaderHighlightStatus = "in_progress" | "ready" | "error";

export type ReaderHighlightAnalysis = {
  term: string;
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
};

export type ReaderHighlight = ReaderHighlightAnalysis & {
  id: number;
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrenceCount: number;
  status: ReaderHighlightStatus;
  errorMessage: string;
  contextBefore: string;
  contextAfter: string;
  importedCardId: number | null;
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  location: ReaderSavedLocation;
};

export type ReaderHighlightImportStatus =
  | "created"
  | "duplicate"
  | "already_imported"
  | "not_ready"
  | "missing";

export type ReaderHighlightImportResult = {
  highlightId: number;
  status: ReaderHighlightImportStatus;
};

export type ReaderHighlightImportSummary = {
  created: number;
  duplicate: number;
  alreadyImported: number;
  notReady: number;
  missing: number;
};

export type ReaderToolsPanel = "current" | "highlights" | "settings";

export type ReaderToolsRailState = {
  activePanel: ReaderToolsPanel;
  selectedHighlightIds: number[];
  selectedDeckId: number | null;
  activeHighlightId: number | null;
};

export type ReaderPreferences = {
  fontSize: number;
  lineHeight: number;
  readingWidth: number;
};

type ReaderLibraryItemBase = {
  publicId: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  lastReadAt: Date | null;
  highlightCount: number;
};

export type ReaderArticleLibraryItem = ReaderLibraryItemBase & {
  kind: "article";
  sourceKind: "url" | "text";
  sourceUrl: string | null;
  readAt: Date | null;
  ingest: {
    status: "pending" | "in_progress" | "ready" | "error";
    error: string;
  };
};

export type ReaderBookLibraryItem = ReaderLibraryItemBase & {
  kind: "book";
  author: string;
  fingerprint: string;
  fileName: string;
  coverPath: string;
  progress: {
    locator: ReaderBookLocator;
    furthestLocator: ReaderBookLocator;
    lastOpenedAt: Date | null;
  } | null;
};

export type ReaderLibraryItem =
  | ReaderArticleLibraryItem
  | ReaderBookLibraryItem;

type ReaderExplainPayloadBase = {
  publicId: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  occurrenceHint: number;
  retry: boolean;
};

export type ReaderArticleExplainPayload = ReaderExplainPayloadBase & {
  kind: "article";
};

export type ReaderBookExplainPayload = ReaderExplainPayloadBase & {
  kind: "book";
  sectionText: string;
  locator: ReaderBookLocator;
  chapterTitle: string;
  progression: number;
};

export type ReaderExplainPayload =
  | ReaderArticleExplainPayload
  | ReaderBookExplainPayload;

export function shouldAutoExplainSelection(selectedText: string): boolean {
  const selectionLength = selectedText.trim().length;
  return (
    selectionLength > 0 &&
    selectionLength <= READER_AUTO_EXPLAIN_MAX_LENGTH
  );
}

export function buildReaderExplainPayload(options: {
  resource: ReaderResource;
  draft: ReaderSelectionDraft;
  retry?: boolean;
}): ReaderExplainPayload {
  const base = {
    publicId: options.resource.publicId,
    selectedText: options.draft.selectedText,
    contextBefore: options.draft.contextBefore,
    contextAfter: options.draft.contextAfter,
    occurrenceHint: options.draft.occurrenceHint,
    retry: options.retry ?? false,
  };

  if (
    options.resource.kind === "article" &&
    options.draft.location.kind === "article" &&
    options.draft.sourceContext.kind === "article"
  ) {
    return {
      kind: "article",
      ...base,
    };
  }

  if (
    options.resource.kind === "book" &&
    options.draft.location.kind === "book" &&
    options.draft.sourceContext.kind === "book"
  ) {
    return {
      kind: "book",
      ...base,
      sectionText: options.draft.sourceContext.sectionText,
      locator: options.draft.location.locator,
      chapterTitle: options.draft.location.chapterTitle,
      progression: options.draft.location.progression,
    };
  }

  throw new Error("Selection does not match the reader resource.");
}
