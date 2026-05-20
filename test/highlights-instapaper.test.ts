import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBulkExportNotification,
  buildExportResultNotification,
  emptyBulkExportStats,
  exportEligibility,
  ineligibleExportNotice,
  isExportableBookmark,
  updateBulkExportStats,
} from "../koala/reader/ui/instapaper/export-helpers.ts";
import {
  compactContextSummary,
  formatAnalysisAsExplanation,
  hasAnalysis,
  resolveExplainActionState,
  resolveHighlightBadgeMeta,
  resolveHighlightRowState,
  resolveHighlightsHistoryState,
  resolveHighlightsVisibility,
  type ReaderArticleHighlightLike,
} from "../koala/reader/ui/highlights-state.ts";

test("highlight state helpers derive row display state", () => {
  const highlight: ReaderArticleHighlightLike = {
    selectedText: "선택된 문장",
    selectedOccurrenceIndex: 1,
    occurrenceCount: 3,
    status: "ready",
    errorMessage: "",
    contextBefore: "앞 문맥 ".repeat(20),
    contextAfter: "뒤 문맥 ".repeat(20),
    importedCardId: null,
    createdAt: new Date("2025-01-01T12:00:00Z"),
    term: "단어",
    definition: "뜻",
    generalMeaning: "일반 의미",
    meaningInContext: "문맥 의미",
  };

  const rowState = resolveHighlightRowState(highlight, null, true);
  assert.equal(rowState.canSelect, true);
  assert.equal(rowState.highlightHasAnalysis, true);
  assert.equal(rowState.toggleLabel, "Hide explanation");
  assert.equal(rowState.badgeMeta, null);
  assert.equal(rowState.hasContextSummary, true);
  assert.ok(
    formatAnalysisAsExplanation(rowState.analysis).includes("단어: 뜻"),
  );
  assert.equal(hasAnalysis(rowState.analysis), true);
  assert.ok(
    compactContextSummary(highlight).match.includes("선택된 문장"),
  );
});

test("highlight state helpers summarize list visibility and actions", () => {
  assert.deepEqual(
    resolveExplainActionState({
      onAddToDeck: () => {},
      canAddToDeck: true,
      isExplaining: false,
      isDeletingHighlight: false,
      isAddingToDeck: true,
      canDeleteHighlight: false,
      onDeleteHighlight: () => {},
    }),
    {
      showAddAction: true,
      showDeleteAction: true,
      addDisabled: false,
      deleteDisabled: true,
      isAddingToDeck: true,
      isDeletingHighlight: false,
    },
  );

  assert.equal(
    resolveExplainActionState({
      onAddToDeck: () => {},
      canAddToDeck: true,
      isExplaining: true,
      isDeletingHighlight: false,
      isAddingToDeck: false,
      canDeleteHighlight: true,
      onDeleteHighlight: () => {},
    }).deleteDisabled,
    false,
  );

  assert.deepEqual(resolveHighlightsVisibility([1, 2, 3, 4, 5], false), {
    visibleHighlights: [1, 2, 3, 4],
    hiddenCount: 1,
    canExpand: true,
    canCollapse: false,
  });

  assert.deepEqual(
    resolveHighlightsHistoryState({
      isLoading: false,
      errorMessage: "",
      highlightCount: 0,
    }),
    {
      showError: false,
      showEmpty: true,
      showList: false,
    },
  );
});

test("highlight state helpers cover badges, empty analysis, and error rows", () => {
  const baseHighlight: ReaderArticleHighlightLike = {
    selectedText: " ".repeat(2),
    selectedOccurrenceIndex: 0,
    occurrenceCount: 1,
    status: "ready",
    errorMessage: "",
    contextBefore: "",
    contextAfter: "",
    importedCardId: null,
    createdAt: new Date("bad date"),
    term: "",
    definition: "",
    generalMeaning: "",
    meaningInContext: "",
  };

  assert.equal(hasAnalysis(null), false);
  assert.equal(hasAnalysis(baseHighlight), false);
  assert.deepEqual(compactContextSummary(baseHighlight), {
    before: "",
    match: "",
    after: "",
  });
  assert.deepEqual(resolveHighlightBadgeMeta(baseHighlight, "duplicate"), {
    label: "Duplicate",
    color: "gray",
  });
  assert.deepEqual(resolveHighlightBadgeMeta(baseHighlight, "not_ready"), {
    label: "Not ready",
    color: "yellow",
  });
  assert.deepEqual(
    resolveHighlightBadgeMeta(
      { ...baseHighlight, status: "in_progress" },
      null,
    ),
    {
      label: "Pending",
      color: "yellow",
    },
  );
  assert.deepEqual(
    resolveHighlightBadgeMeta({ ...baseHighlight, status: "error" }, null),
    {
      label: "Error",
      color: "red",
    },
  );

  const rowState = resolveHighlightRowState(
    {
      ...baseHighlight,
      status: "error",
      errorMessage: " explain failed ",
    },
    null,
    false,
  );
  assert.equal(rowState.canSelect, false);
  assert.equal(rowState.showErrorMessage, true);
  assert.equal(rowState.highlightHasAnalysis, false);
  assert.equal(rowState.metaLine, "Occurrence 1 of 1 • Invalid Date");
  assert.equal(rowState.toggleLabel, "Show explanation");

  assert.deepEqual(resolveHighlightsVisibility([1, 2, 3, 4, 5], true), {
    visibleHighlights: [1, 2, 3, 4, 5],
    hiddenCount: 0,
    canExpand: false,
    canCollapse: true,
  });
  assert.deepEqual(
    resolveHighlightsHistoryState({
      isLoading: false,
      errorMessage: " load failed ",
      highlightCount: 2,
    }),
    {
      showError: true,
      showEmpty: false,
      showList: true,
    },
  );
});

test("instapaper export helpers report eligibility and summary messages", () => {
  assert.deepEqual(exportEligibility({ localArticle: null }), {
    eligible: false,
    reason: "missing_local_article",
  });
  assert.deepEqual(ineligibleExportNotice("not_ready"), {
    title: "Article not ready",
    message: "Wait until the article is ready, then export.",
  });
  assert.deepEqual(ineligibleExportNotice("missing_local_article"), {
    title: "No local article",
    message: "Import this bookmark to Koala before exporting.",
  });
  assert.deepEqual(
    exportEligibility({
      localArticle: {
        publicId: "article-1",
        ingestStatus: "ready",
      },
    }),
    {
      eligible: true,
      localArticle: {
        publicId: "article-1",
        ingestStatus: "ready",
      },
    },
  );
  assert.equal(
    isExportableBookmark({
      localArticle: {
        publicId: "article-1",
        ingestStatus: "queued",
      },
    }),
    false,
  );

  let stats = emptyBulkExportStats();
  stats = updateBulkExportStats(stats, {
    status: "exported_and_archived",
    message: null,
  });
  stats = updateBulkExportStats(stats, {
    status: "exported_archive_failed",
    message: "Archive failed",
  });
  stats = updateBulkExportStats(stats, {
    status: "failed",
    message: "Export failed",
  });

  assert.deepEqual(
    buildExportResultNotification({
      status: "exported",
      message: null,
    }),
    {
      title: "Exported",
      message: "Article exported to Instapaper.",
      color: "green",
    },
  );
  assert.deepEqual(
    buildExportResultNotification({
      status: "exported_and_archived",
      message: null,
    }),
    {
      title: "Exported",
      message: "Article exported and original bookmark archived.",
      color: "green",
    },
  );
  assert.deepEqual(
    buildExportResultNotification({
      status: "exported_archive_failed",
      message: "",
    }),
    {
      title: "Partial success",
      message: "Exported, but archiving the original bookmark failed.",
      color: "yellow",
    },
  );
  assert.equal(
    buildExportResultNotification({
      status: "failed",
      message: "Export failed",
    }),
    null,
  );

  assert.deepEqual(buildBulkExportNotification(stats, true), {
    title: "Export all finished with issues",
    message:
      "2 article(s) exported. 1 original bookmark(s) archived. 1 archive attempt(s) failed. 1 export(s) failed. First issue: Archive failed",
    color: "yellow",
  });
  assert.deepEqual(
    buildBulkExportNotification(
      {
        exported: 2,
        archived: 0,
        archiveFailed: 0,
        failed: 0,
        firstIssue: null,
      },
      false,
    ),
    {
      title: "Export all complete",
      message: "2 article(s) exported.",
      color: "green",
    },
  );
});
