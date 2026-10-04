import { readerBookLocatorSchema } from "./book";
import type {
  ReaderHighlight,
  ReaderHighlightImportResult,
  ReaderHighlightImportStatus,
  ReaderHighlightImportSummary,
  ReaderResource,
} from "./contracts";

type PersistedHighlightStatus = "IN_PROGRESS" | "READY" | "ERROR";

type ReaderHighlightRecordBase = {
  id: number;
  selectedOccurrenceIndex: number;
  occurrenceCount: number;
  status: PersistedHighlightStatus;
  term: string;
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
  errorMessage: string;
  importedCardId: number | null;
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ArticleReaderHighlightRecord = ReaderHighlightRecordBase & {
  selectedText: string;
  occurrencesJson: unknown;
};

export type BookReaderHighlightRecord = ReaderHighlightRecordBase & {
  quote: string;
  contextBefore: string;
  contextAfter: string;
  locatorJson: unknown;
  chapterTitle: string;
  progression: number;
};

export type ReaderHighlightImportCandidate = {
  id: number;
  status: PersistedHighlightStatus;
  term: string;
  definition: string;
  importedCardId: number | null;
};

export function readerHighlightLinkWhere(options: {
  resource: ReaderResource;
  resourceId: number;
  highlightId: number;
  userId: string;
}) {
  const base = {
    id: options.highlightId,
    userId: options.userId,
    importedCardId: null,
  };
  if (options.resource.kind === "article") {
    return { ...base, articleId: options.resourceId };
  }
  return { ...base, bookId: options.resourceId };
}

function mapHighlightStatus(
  status: PersistedHighlightStatus,
): ReaderHighlight["status"] {
  if (status === "IN_PROGRESS") {
    return "in_progress";
  }
  if (status === "READY") {
    return "ready";
  }
  return "error";
}

function parseArticleContext(
  occurrencesJson: unknown,
  occurrenceIndex: number,
): { before: string; after: string } {
  if (!Array.isArray(occurrencesJson)) {
    return { before: "", after: "" };
  }
  const occurrence = occurrencesJson[occurrenceIndex];
  if (!occurrence || typeof occurrence !== "object") {
    return { before: "", after: "" };
  }
  const before = (occurrence as { before?: unknown }).before;
  const after = (occurrence as { after?: unknown }).after;
  return {
    before: typeof before === "string" ? before : "",
    after: typeof after === "string" ? after : "",
  };
}

export function mapArticleReaderHighlight(
  highlight: ArticleReaderHighlightRecord,
): ReaderHighlight {
  const context = parseArticleContext(
    highlight.occurrencesJson,
    highlight.selectedOccurrenceIndex,
  );
  return {
    id: highlight.id,
    selectedText: highlight.selectedText,
    selectedOccurrenceIndex: highlight.selectedOccurrenceIndex,
    occurrenceCount: highlight.occurrenceCount,
    status: mapHighlightStatus(highlight.status),
    term: highlight.term,
    definition: highlight.definition,
    generalMeaning: highlight.generalMeaning,
    meaningInContext: highlight.meaningInContext,
    errorMessage: highlight.errorMessage,
    contextBefore: context.before,
    contextAfter: context.after,
    importedCardId: highlight.importedCardId,
    importedAt: highlight.importedAt,
    createdAt: highlight.createdAt,
    updatedAt: highlight.updatedAt,
    location: {
      kind: "article",
      occurrenceIndex: highlight.selectedOccurrenceIndex,
    },
  };
}

export function mapBookReaderHighlight(
  highlight: BookReaderHighlightRecord,
): ReaderHighlight {
  const parsedLocator = readerBookLocatorSchema.safeParse(
    highlight.locatorJson,
  );
  return {
    id: highlight.id,
    selectedText: highlight.quote,
    selectedOccurrenceIndex: highlight.selectedOccurrenceIndex,
    occurrenceCount: highlight.occurrenceCount,
    status: mapHighlightStatus(highlight.status),
    term: highlight.term,
    definition: highlight.definition,
    generalMeaning: highlight.generalMeaning,
    meaningInContext: highlight.meaningInContext,
    errorMessage: highlight.errorMessage,
    contextBefore: highlight.contextBefore,
    contextAfter: highlight.contextAfter,
    importedCardId: highlight.importedCardId,
    importedAt: highlight.importedAt,
    createdAt: highlight.createdAt,
    updatedAt: highlight.updatedAt,
    location: {
      kind: "book",
      locator: parsedLocator.success ? parsedLocator.data : { href: "#" },
      chapterTitle: highlight.chapterTitle,
      progression: highlight.progression,
    },
  };
}

export function canImportReaderHighlight(
  highlight: ReaderHighlightImportCandidate,
): boolean {
  return (
    highlight.importedCardId === null &&
    highlight.status === "READY" &&
    highlight.term.trim().length > 0 &&
    highlight.definition.trim().length > 0
  );
}

export function resolveReaderHighlightImportStatus(options: {
  highlight: ReaderHighlightImportCandidate | undefined;
  existingCardByTerm: Map<string, number>;
}): Exclude<ReaderHighlightImportStatus, "created"> | null {
  if (!options.highlight) {
    return "missing";
  }
  if (options.highlight.importedCardId !== null) {
    return "already_imported";
  }
  if (!canImportReaderHighlight(options.highlight)) {
    return "not_ready";
  }
  if (options.existingCardByTerm.has(options.highlight.term)) {
    return "duplicate";
  }
  return null;
}

export function emptyReaderHighlightImportSummary(): ReaderHighlightImportSummary {
  return {
    created: 0,
    duplicate: 0,
    alreadyImported: 0,
    notReady: 0,
    missing: 0,
  };
}

export function recordReaderHighlightImportResult(options: {
  summary: ReaderHighlightImportSummary;
  results: ReaderHighlightImportResult[];
  highlightId: number;
  status: ReaderHighlightImportStatus;
}): void {
  const summaryKeyByStatus: Record<
    ReaderHighlightImportStatus,
    keyof ReaderHighlightImportSummary
  > = {
    created: "created",
    duplicate: "duplicate",
    already_imported: "alreadyImported",
    not_ready: "notReady",
    missing: "missing",
  };

  options.summary[summaryKeyByStatus[options.status]] += 1;
  options.results.push({
    highlightId: options.highlightId,
    status: options.status,
  });
}
