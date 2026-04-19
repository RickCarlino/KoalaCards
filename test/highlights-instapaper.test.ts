import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBulkExportNotification,
  buildExportResultNotification,
  emptyBulkExportStats,
  exportEligibility,
  ineligibleExportNotice,
  updateBulkExportStats,
} from "../koala/reader/ui/instapaper/export-helpers.ts";
import {
  compactContextSummary,
  formatAnalysisAsExplanation,
  hasAnalysis,
  resolveExplainActionState,
  resolveHighlightRowState,
  resolveHighlightsHistoryState,
  resolveHighlightsVisibility,
} from "../koala/reader/ui/highlights-state.ts";

test("highlight state helpers derive row display state", () => {
  const highlight = {
    selectedText: "선택된 문장",
    selectedOccurrenceIndex: 1,
    occurrenceCount: 3,
    status: "ready" as const,
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

test("instapaper export helpers report eligibility and summary messages", () => {
  assert.deepEqual(exportEligibility({ localArticle: null }), {
    eligible: false,
    reason: "missing_local_article",
  });
  assert.deepEqual(ineligibleExportNotice("not_ready"), {
    title: "Article not ready",
    message: "Wait until the article is ready, then export.",
  });

  let stats = emptyBulkExportStats();
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

  assert.deepEqual(buildBulkExportNotification(stats, true), {
    title: "Export all finished with issues",
    message:
      "1 article(s) exported. 0 original bookmark(s) archived. 1 archive attempt(s) failed. 1 export(s) failed. First issue: Archive failed",
    color: "yellow",
  });
});
