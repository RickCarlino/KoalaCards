import {
  Box,
  Button,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import React from "react";
import { shouldAutoExplainSelection } from "../contracts";
import {
  ExplainSelectionCard,
  HighlightsHistoryCard,
  type ReaderHighlight,
} from "./highlights";
import { shouldShowReaderRetryAction } from "./highlights-state";
import type { ReaderHighlightController } from "./use-reader-highlight-controller";

const toolsRailStyle: React.CSSProperties = {
  minWidth: 0,
  height: "100%",
  overflow: "hidden",
};

const toolsContentStyle: React.CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  maxHeight: "calc(100svh - 190px)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  paddingRight: 2,
  scrollbarWidth: "none",
};

function currentReaderSelectionText(
  controller: ReaderHighlightController,
): string {
  if (controller.selectionDraft) {
    return controller.selectionDraft.selectedText;
  }
  return controller.activeHighlight?.selectedText ?? "";
}

function showManualReaderExplain(
  controller: ReaderHighlightController,
): boolean {
  if (!controller.selectionDraft || controller.isExplaining) {
    return false;
  }
  return !shouldAutoExplainSelection(
    controller.selectionDraft.selectedText,
  );
}

function activeReaderHighlightId(
  controller: ReaderHighlightController,
): number | null {
  return controller.activeHighlight?.id ?? null;
}

function activeReaderImportAction(
  controller: ReaderHighlightController,
): (() => Promise<void>) | undefined {
  if (!controller.activeHighlight) {
    return undefined;
  }
  return controller.importCurrent;
}

function activeReaderDeleteAction(
  controller: ReaderHighlightController,
  highlightId: number | null,
): (() => void) | undefined {
  if (highlightId === null) {
    return undefined;
  }
  return () => {
    void controller.deleteHighlight(highlightId);
  };
}

function isDeletingActiveReaderHighlight(
  controller: ReaderHighlightController,
  highlightId: number | null,
): boolean {
  if (highlightId === null) {
    return false;
  }
  return controller.deletingHighlightId === highlightId;
}

function CurrentSelection({
  controller,
  selectedText,
  showManualExplain,
}: {
  controller: ReaderHighlightController;
  selectedText: string;
  showManualExplain: boolean;
}) {
  if (!selectedText) {
    return (
      <Text size="sm" c="dimmed">
        Select text to explain.
      </Text>
    );
  }

  return (
    <>
      <Text fw={700} style={{ overflowWrap: "anywhere" }}>
        {selectedText}
      </Text>
      {showManualExplain ? (
        <Button
          size="compact-sm"
          color="grape"
          onClick={controller.explainCurrent}
        >
          Explain
        </Button>
      ) : null}
    </>
  );
}

function CurrentHighlightPanel({
  controller,
}: {
  controller: ReaderHighlightController;
}) {
  const selectedText = currentReaderSelectionText(controller);
  const showManualExplain = showManualReaderExplain(controller);
  const canRetry = shouldShowReaderRetryAction({
    hasRetryDraft: controller.retryDraft !== null,
    isExplaining: controller.isExplaining,
    showManualExplain,
  });
  const activeHighlightId = activeReaderHighlightId(controller);

  return (
    <Stack gap="sm">
      <CurrentSelection
        controller={controller}
        selectedText={selectedText}
        showManualExplain={showManualExplain}
      />
      <ExplainSelectionCard
        isExplaining={controller.isExplaining}
        streamError={controller.streamError}
        analysis={controller.analysis}
        onAddToDeck={activeReaderImportAction(controller)}
        canAddToDeck={controller.canImportCurrent}
        isAddingToDeck={controller.isImportingCurrent}
        onRetryHighlight={canRetry ? controller.retryCurrent : undefined}
        canRetryHighlight={canRetry}
        isRetryingHighlight={controller.isExplaining}
        onDeleteHighlight={activeReaderDeleteAction(
          controller,
          activeHighlightId,
        )}
        canDeleteHighlight={activeHighlightId !== null}
        isDeletingHighlight={isDeletingActiveReaderHighlight(
          controller,
          activeHighlightId,
        )}
        flowExplanation
      />
    </Stack>
  );
}

function HighlightsPanel({
  controller,
  onOpenHighlight,
}: {
  controller: ReaderHighlightController;
  onOpenHighlight: (highlight: ReaderHighlight) => void;
}) {
  return (
    <HighlightsHistoryCard
      highlights={controller.highlights}
      isLoading={controller.workspaceQuery.isLoading}
      errorMessage={controller.workspaceQuery.error?.message ?? ""}
      deletingHighlightId={controller.deletingHighlightId}
      selectedHighlightIds={controller.selectedHighlightIds}
      onToggleHighlightSelection={controller.toggleHighlightSelection}
      onImportSelected={() => {
        void controller.importSelected();
      }}
      canImportSelected={controller.canImportSelected}
      isImportingSelected={controller.isImportingSelected}
      onToggleSelectAll={controller.toggleSelectAll}
      canSelectAll={controller.importableIds.length > 0}
      allImportableSelected={controller.allImportableSelected}
      importStatusByHighlightId={controller.importStatusByHighlightId}
      onDeleteHighlight={(highlightId) => {
        void controller.deleteHighlight(highlightId);
      }}
      onOpenHighlight={onOpenHighlight}
    />
  );
}

export function ReaderToolsRail({
  controller,
  settings,
  onOpenHighlight,
}: {
  controller: ReaderHighlightController;
  settings: React.ReactNode;
  onOpenHighlight: (highlight: ReaderHighlight) => void;
}) {
  const deckOptions = controller.decks.map((deck) => ({
    value: String(deck.id),
    label: deck.name,
  }));

  return (
    <Box component="aside" style={toolsRailStyle}>
      <style jsx global>{`
        .reader-tools-content::-webkit-scrollbar {
          display: none;
        }
        @media (max-width: 840px) {
          .reader-tools-content {
            max-height: none !important;
          }
        }
      `}</style>
      <Stack gap="sm" h="100%">
        {deckOptions.length > 0 ? (
          <Select
            label="Deck"
            data={deckOptions}
            value={controller.selectedDeckId}
            onChange={controller.setSelectedDeckId}
            size="xs"
          />
        ) : (
          <Text size="sm" c="dimmed">
            Create a deck to add highlights.
          </Text>
        )}
        <SegmentedControl
          value={controller.activePanel}
          onChange={(value) => {
            if (
              value === "current" ||
              value === "highlights" ||
              value === "settings"
            ) {
              controller.setActivePanel(value);
            }
          }}
          data={[
            { label: "Current", value: "current" },
            { label: "Highlights", value: "highlights" },
            { label: "Settings", value: "settings" },
          ]}
          fullWidth
          size="xs"
          color="grape"
        />
        <Box className="reader-tools-content" style={toolsContentStyle}>
          {controller.activePanel === "current" ? (
            <CurrentHighlightPanel controller={controller} />
          ) : null}
          {controller.activePanel === "highlights" ? (
            <HighlightsPanel
              controller={controller}
              onOpenHighlight={onOpenHighlight}
            />
          ) : null}
          {controller.activePanel === "settings" ? settings : null}
        </Box>
      </Stack>
    </Box>
  );
}
