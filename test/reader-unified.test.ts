import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  combineReaderCounts,
  combineReaderHighlightActivity,
  combineReaderHighlightDates,
} from "../koala/reader/activity.ts";
import { scrollToArticleHighlight } from "../koala/reader/article-location.ts";
import {
  ARTICLE_SELECTION_COMPLETION_EVENTS,
  listenForCompletedArticleSelections,
} from "../koala/reader/article-selection.ts";
import {
  findReaderBookSectionIndex,
  normalizeReaderBookHref,
} from "../koala/reader/book-location.ts";
import {
  buildReaderExplainPayload,
  shouldAutoExplainSelection,
  type ReaderHighlight,
  type ReaderLibraryItem,
  type ReaderSelectionDraft,
} from "../koala/reader/contracts.ts";
import { localBookDataStoreNames } from "../koala/reader/epub/local-library.ts";
import {
  allReaderHighlightsSelected,
  importableReaderHighlightIds,
  readerHighlightImportSummaryMessage,
  toggleAllReaderHighlights,
  toggleReaderHighlightSelection,
} from "../koala/reader/highlight-controller-state.ts";
import { shouldLoadReaderHighlightCache } from "../koala/reader/highlight-cache.ts";
import {
  DEFAULT_READER_PREFERENCES,
  resolveReaderPreferences,
} from "../koala/reader/preferences.ts";
import {
  filterAndSortReaderDocuments,
  readerDocumentFilterCounts,
} from "../koala/reader/library.ts";
import { resolveReaderOwnership } from "../koala/reader/ownership.ts";
import {
  isCurrentReaderRequest,
  nextReaderRequestId,
} from "../koala/reader/request-state.ts";
import { parseReaderSseEvent } from "../koala/reader/sse-client.ts";
import {
  canImportReaderHighlight,
  emptyReaderHighlightImportSummary,
  mapArticleReaderHighlight,
  mapBookReaderHighlight,
  readerHighlightLinkWhere,
  recordReaderHighlightImportResult,
  resolveReaderHighlightImportStatus,
} from "../koala/reader/server-highlights.ts";

function articleDraft(selectedText = "단어"): ReaderSelectionDraft {
  return {
    selectedText,
    contextBefore: "앞",
    contextAfter: "뒤",
    occurrenceHint: 2,
    location: { kind: "article", occurrenceIndex: 2 },
    sourceContext: { kind: "article" },
  };
}

function bookDraft(): ReaderSelectionDraft {
  return {
    selectedText: "문장",
    contextBefore: "앞",
    contextAfter: "뒤",
    occurrenceHint: 1,
    location: {
      kind: "book",
      locator: {
        href: "chapter.xhtml#part",
        progression: 0.4,
      },
      chapterTitle: "Chapter",
      progression: 0.4,
    },
    sourceContext: {
      kind: "book",
      sectionText: "앞 문장 뒤",
    },
  };
}

function highlight(overrides: Partial<ReaderHighlight>): ReaderHighlight {
  return {
    id: 1,
    selectedText: "단어",
    selectedOccurrenceIndex: 0,
    occurrenceCount: 1,
    status: "ready",
    term: "단어",
    definition: "word",
    generalMeaning: "word",
    meaningInContext: "word here",
    errorMessage: "",
    contextBefore: "앞",
    contextAfter: "뒤",
    importedCardId: null,
    importedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    location: { kind: "article", occurrenceIndex: 0 },
    ...overrides,
  };
}

test("reader explanation rules and payloads support both locations", () => {
  assert.equal(shouldAutoExplainSelection("가".repeat(80)), true);
  assert.equal(shouldAutoExplainSelection("가".repeat(81)), false);
  assert.equal(shouldAutoExplainSelection("   "), false);
  assert.deepEqual(
    buildReaderExplainPayload({
      resource: { kind: "article", publicId: "article-1" },
      draft: articleDraft(),
    }),
    {
      kind: "article",
      publicId: "article-1",
      selectedText: "단어",
      contextBefore: "앞",
      contextAfter: "뒤",
      occurrenceHint: 2,
      retry: false,
    },
  );
  assert.deepEqual(
    buildReaderExplainPayload({
      resource: { kind: "book", publicId: "book-1" },
      draft: bookDraft(),
      retry: true,
    }),
    {
      kind: "book",
      publicId: "book-1",
      selectedText: "문장",
      contextBefore: "앞",
      contextAfter: "뒤",
      occurrenceHint: 1,
      retry: true,
      sectionText: "앞 문장 뒤",
      locator: {
        href: "chapter.xhtml#part",
        progression: 0.4,
      },
      chapterTitle: "Chapter",
      progression: 0.4,
    },
  );
  assert.throws(() => {
    buildReaderExplainPayload({
      resource: { kind: "book", publicId: "book-1" },
      draft: articleDraft(),
    });
  });
});

test("reader request IDs reject cancelled and stale responses", () => {
  const first = nextReaderRequestId(0);
  const second = nextReaderRequestId(first);
  assert.equal(
    isCurrentReaderRequest({
      activeRequestId: second,
      requestId: first,
      aborted: false,
    }),
    false,
  );
  assert.equal(
    isCurrentReaderRequest({
      activeRequestId: second,
      requestId: second,
      aborted: true,
    }),
    false,
  );
  assert.equal(
    isCurrentReaderRequest({
      activeRequestId: second,
      requestId: second,
      aborted: false,
    }),
    true,
  );
});

test("the shared SSE parser preserves event names and multiline data", () => {
  assert.deepEqual(
    parseReaderSseEvent(
      "event: analysis\ndata: first line\ndata: second line",
    ),
    {
      event: "analysis",
      data: "first line\nsecond line",
    },
  );
  assert.equal(parseReaderSseEvent("event: done"), null);
});

test("retry bypasses cached article and book explanations", () => {
  for (const kind of ["article", "book"] as const) {
    assert.equal(
      shouldLoadReaderHighlightCache({ kind, retry: false }),
      true,
    );
    assert.equal(
      shouldLoadReaderHighlightCache({ kind, retry: true }),
      false,
    );
  }
});

test("reader DTO mappers preserve format-specific locations", () => {
  const createdAt = new Date("2026-02-01T00:00:00Z");
  const article = mapArticleReaderHighlight({
    id: 4,
    selectedText: "말",
    selectedOccurrenceIndex: 1,
    occurrenceCount: 2,
    occurrencesJson: [
      { before: "x", match: "말", after: "y" },
      { before: "앞", match: "말", after: "뒤" },
    ],
    status: "READY",
    term: "말",
    definition: "speech",
    generalMeaning: "speech",
    meaningInContext: "words",
    errorMessage: "",
    importedCardId: null,
    importedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
  assert.deepEqual(article.location, {
    kind: "article",
    occurrenceIndex: 1,
  });
  assert.equal(article.contextBefore, "앞");

  const book = mapBookReaderHighlight({
    id: 5,
    quote: "문장",
    selectedOccurrenceIndex: 0,
    occurrenceCount: 1,
    status: "ERROR",
    term: "",
    definition: "",
    generalMeaning: "",
    meaningInContext: "",
    errorMessage: "failed",
    contextBefore: "앞",
    contextAfter: "뒤",
    locatorJson: { href: "one.xhtml", totalProgression: 0.25 },
    chapterTitle: "One",
    progression: 0.25,
    importedCardId: null,
    importedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
  assert.equal(book.location.kind, "book");
  assert.deepEqual(book.location, {
    kind: "book",
    locator: { href: "one.xhtml", totalProgression: 0.25 },
    chapterTitle: "One",
    progression: 0.25,
  });
});

test("reader selection and select-all only include importable highlights", () => {
  const highlights = [
    highlight({ id: 1 }),
    highlight({ id: 2, importedCardId: 20 }),
    highlight({ id: 3, status: "error" }),
  ];
  const importableIds = importableReaderHighlightIds(highlights);
  assert.deepEqual(importableIds, [1]);
  assert.deepEqual(
    toggleReaderHighlightSelection({
      selectedIds: [],
      highlightId: 1,
      selected: true,
    }),
    [1],
  );
  assert.deepEqual(
    toggleAllReaderHighlights({
      selectedIds: [],
      importableIds,
    }),
    [1],
  );
  assert.equal(
    allReaderHighlightsSelected({ selectedIds: [1], importableIds }),
    true,
  );
  assert.deepEqual(
    toggleAllReaderHighlights({
      selectedIds: [1],
      importableIds,
    }),
    [],
  );
});

test("reader imports account for every result and reject ineligible rows", () => {
  const ready = {
    id: 1,
    status: "READY" as const,
    term: "말",
    definition: "speech",
    importedCardId: null,
  };
  assert.equal(canImportReaderHighlight(ready), true);
  assert.equal(
    resolveReaderHighlightImportStatus({
      highlight: undefined,
      existingCardByTerm: new Map(),
    }),
    "missing",
  );
  assert.equal(
    resolveReaderHighlightImportStatus({
      highlight: { ...ready, importedCardId: 4 },
      existingCardByTerm: new Map(),
    }),
    "already_imported",
  );
  assert.equal(
    resolveReaderHighlightImportStatus({
      highlight: { ...ready, status: "ERROR" },
      existingCardByTerm: new Map(),
    }),
    "not_ready",
  );
  assert.equal(
    resolveReaderHighlightImportStatus({
      highlight: ready,
      existingCardByTerm: new Map([["말", 9]]),
    }),
    "duplicate",
  );

  const summary = emptyReaderHighlightImportSummary();
  const results: {
    highlightId: number;
    status:
      | "created"
      | "duplicate"
      | "already_imported"
      | "not_ready"
      | "missing";
  }[] = [];
  const statuses = [
    "created",
    "duplicate",
    "already_imported",
    "not_ready",
    "missing",
  ] as const;
  statuses.forEach((status, index) => {
    recordReaderHighlightImportResult({
      summary,
      results,
      highlightId: index + 1,
      status,
    });
  });
  assert.deepEqual(summary, {
    created: 1,
    duplicate: 1,
    alreadyImported: 1,
    notReady: 1,
    missing: 1,
  });
  assert.equal(
    readerHighlightImportSummaryMessage(summary),
    "1 added · 1 duplicate · 1 already added · 1 not ready · 1 missing",
  );
});

test("shared import linking and ownership policies cover articles and books", () => {
  assert.deepEqual(
    readerHighlightLinkWhere({
      resource: { kind: "article", publicId: "article-1" },
      resourceId: 10,
      highlightId: 11,
      userId: "user-1",
    }),
    {
      id: 11,
      userId: "user-1",
      importedCardId: null,
      articleId: 10,
    },
  );
  assert.deepEqual(
    readerHighlightLinkWhere({
      resource: { kind: "book", publicId: "book-1" },
      resourceId: 20,
      highlightId: 21,
      userId: "user-1",
    }),
    {
      id: 21,
      userId: "user-1",
      importedCardId: null,
      bookId: 20,
    },
  );
  assert.deepEqual(resolveReaderOwnership(null, "user-1"), {
    status: "missing",
  });
  assert.deepEqual(
    resolveReaderOwnership({ id: 1, userId: "user-2" }, "user-1"),
    { status: "forbidden" },
  );
  assert.deepEqual(
    resolveReaderOwnership({ id: 1, userId: "user-1" }, "user-1"),
    { status: "owned", id: 1 },
  );
});

test("reader location helpers scroll marks and select EPUB sections", () => {
  let scrollOptions: ScrollIntoViewOptions | null = null;
  const mark = {
    scrollIntoView: (options: ScrollIntoViewOptions) => {
      scrollOptions = options;
    },
  };
  const article = {
    querySelector: (selector: string) => {
      return selector === 'mark[data-highlight-id="7"]' ? mark : null;
    },
  } as unknown as HTMLElement;
  assert.equal(scrollToArticleHighlight(article, 7), true);
  assert.deepEqual(scrollOptions, {
    behavior: "smooth",
    block: "center",
  });
  assert.equal(scrollToArticleHighlight(article, 8), false);

  const spine = [
    {
      id: "one",
      href: "one.xhtml",
      mediaType: "application/xhtml+xml",
    },
    {
      id: "two",
      href: "chapters/two.xhtml",
      mediaType: "application/xhtml+xml",
    },
  ];
  assert.equal(normalizeReaderBookHref("/one.xhtml#part"), "one.xhtml");
  assert.equal(
    findReaderBookSectionIndex(spine, {
      href: "/chapters/two.xhtml#part",
    }),
    1,
  );
  assert.equal(
    findReaderBookSectionIndex(spine, { href: "missing.xhtml" }),
    0,
  );
});

test("article selections run only after a completed input gesture", () => {
  const added: string[] = [];
  const removed: string[] = [];
  const target = {
    addEventListener: (eventName: string) => {
      added.push(eventName);
    },
    removeEventListener: (eventName: string) => {
      removed.push(eventName);
    },
  };
  const cleanup = listenForCompletedArticleSelections(
    target,
    () => undefined,
  );

  assert.deepEqual(added, [...ARTICLE_SELECTION_COMPLETION_EVENTS]);
  assert.equal(new Set<string>(added).has("selectionchange"), false);
  cleanup();
  assert.deepEqual(removed, added);
});

test("reader preferences preserve valid legacy values and clamp bad input", async () => {
  assert.deepEqual(resolveReaderPreferences(undefined), {
    ...DEFAULT_READER_PREFERENCES,
  });
  assert.deepEqual(
    resolveReaderPreferences({
      fontSize: 23,
      lineHeight: 1.9,
      readingWidth: 940,
    }),
    {
      fontSize: 23,
      lineHeight: 1.9,
      readingWidth: 940,
    },
  );
  assert.deepEqual(
    resolveReaderPreferences({
      fontSize: 100,
      lineHeight: 0,
      readingWidth: Number.NaN,
    }),
    {
      fontSize: 26,
      lineHeight: 1.35,
      readingWidth: 800,
    },
  );

  const migration = await readFile(
    new URL(
      "../prisma/migrations/20260725120000_consolidate_reader/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /RENAME COLUMN "readerBookFontSize" TO "readerFontSize"/,
  );
  assert.match(
    migration,
    /RENAME COLUMN "readerBookLineHeight" TO "readerLineHeight"/,
  );
  assert.match(
    migration,
    /RENAME COLUMN "readerBookColumnWidth" TO "readerReadingWidth"/,
  );
});

test("reader activity combines formats by time and sums statistics", () => {
  const early = new Date("2026-01-01T00:00:00Z");
  const late = new Date("2026-01-02T00:00:00Z");
  const activity = combineReaderHighlightActivity({
    articles: [
      {
        id: 1,
        selectedText: "article",
        selectedOccurrenceIndex: 0,
        occurrencesJson: [
          { before: "before", match: "article", after: "after" },
        ],
        createdAt: early,
        importedAt: null,
        article: { title: "Article" },
      },
    ],
    books: [
      {
        id: 1,
        quote: "book",
        selectedOccurrenceIndex: 0,
        occurrencesJson: [
          { before: "before", match: "book", after: "after" },
        ],
        chapterTitle: "Chapter",
        createdAt: late,
        importedAt: late,
        book: { title: "Book" },
      },
    ],
    limit: 2,
  });
  assert.deepEqual(
    activity.map((row) => row.key),
    ["book-1", "article-1"],
  );
  assert.deepEqual(
    combineReaderHighlightDates({
      articles: [late],
      books: [early],
    }),
    [early, late],
  );
  assert.deepEqual(
    combineReaderCounts({
      articleCount: 2,
      bookCount: 3,
      articleHighlightCount: 4,
      bookHighlightCount: 5,
      importedArticleHighlightCount: 1,
      importedBookHighlightCount: 2,
    }),
    {
      documentCount: 5,
      highlightCount: 9,
      importedHighlightCount: 3,
    },
  );
});

test("reader documents share one source filter and recency order", () => {
  const early = new Date("2026-01-01T00:00:00Z");
  const middle = new Date("2026-01-02T00:00:00Z");
  const late = new Date("2026-01-03T00:00:00Z");
  const documents: ReaderLibraryItem[] = [
    {
      kind: "article",
      publicId: "url-article",
      title: "URL article",
      description: "",
      createdAt: early,
      updatedAt: early,
      highlightCount: 0,
      sourceKind: "url",
      sourceUrl: "https://example.com",
      readAt: null,
      ingest: { status: "ready", error: "" },
    },
    {
      kind: "book",
      publicId: "book",
      title: "Book",
      description: "",
      createdAt: early,
      updatedAt: late,
      highlightCount: 0,
      author: "Author",
      fingerprint: "book-fingerprint",
      fileName: "book.epub",
      coverPath: "",
      progress: null,
    },
    {
      kind: "article",
      publicId: "pasted-text",
      title: "Pasted text",
      description: "",
      createdAt: early,
      updatedAt: middle,
      highlightCount: 0,
      sourceKind: "text",
      sourceUrl: null,
      readAt: early,
      ingest: { status: "ready", error: "" },
    },
  ];

  assert.deepEqual(readerDocumentFilterCounts(documents), {
    all: 3,
    url: 1,
    text: 1,
    epub: 1,
  });
  assert.deepEqual(
    filterAndSortReaderDocuments({
      items: documents,
      filter: "all",
    }).map((document) => document.publicId),
    ["book", "pasted-text", "url-article"],
  );
  assert.deepEqual(
    filterAndSortReaderDocuments({
      items: documents,
      filter: "epub",
    }).map((document) => document.publicId),
    ["book"],
  );
});

test("book cleanup covers only retained handle and cover stores", () => {
  assert.deepEqual(localBookDataStoreNames(), [
    "localBookHandle",
    "localBookCoverCache",
  ]);
});
