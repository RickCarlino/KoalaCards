import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { IconRefresh, IconX } from "@tabler/icons-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ReaderHighlight,
  ReaderHighlightAnalysis,
  ReaderHighlightImportStatus,
} from "../contracts";
import {
  readerBodyFont,
  readerDividerColor,
  readerHeadingColor,
} from "./theme";
import {
  formatAnalysisAsExplanation,
  hasAnalysis,
  resolveExplainActionState,
  resolveHighlightRowState,
  resolveHighlightsHistoryState,
  resolveHighlightsVisibility,
} from "./highlights-state";

export type {
  ReaderHighlight,
  ReaderHighlightAnalysis,
  ReaderHighlightImportStatus,
} from "../contracts";

type ExplainSelectionCardProps = {
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  onDeleteHighlight?: () => void;
  canDeleteHighlight?: boolean;
  isDeletingHighlight?: boolean;
  onRetryHighlight?: () => void;
  canRetryHighlight?: boolean;
  isRetryingHighlight?: boolean;
  onAddToDeck?: () => void;
  canAddToDeck?: boolean;
  isAddingToDeck?: boolean;
  fillAvailableHeight?: boolean;
  flowExplanation?: boolean;
};

function helperPanelStyle(
  fillAvailableHeight: boolean,
): React.CSSProperties | undefined {
  if (!fillAvailableHeight) {
    return undefined;
  }

  return {
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
  };
}

function helperStreamStyle(options: {
  fillAvailableHeight: boolean;
  flowExplanation: boolean;
}): React.CSSProperties {
  if (options.flowExplanation) {
    return {
      paddingBottom: 4,
      overflowWrap: "anywhere",
    };
  }

  const baseStyle: React.CSSProperties = {
    borderLeft: `2px solid ${readerDividerColor}`,
    paddingLeft: 10,
    paddingRight: 4,
    paddingBottom: 4,
  };

  if (!options.fillAvailableHeight) {
    return {
      ...baseStyle,
      maxHeight: 220,
      overflowY: "auto",
    };
  }

  return {
    ...baseStyle,
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
  };
}

function renderExplainLoading(
  isExplaining: boolean,
): React.ReactNode | null {
  if (!isExplaining) {
    return null;
  }

  return (
    <Group gap="xs" align="center" role="status" aria-live="polite">
      <Loader size="xs" color="grape" />
    </Group>
  );
}

function renderExplainError(streamError: string): React.ReactNode | null {
  if (streamError.trim().length === 0) {
    return null;
  }

  return (
    <Text
      size="sm"
      c="red"
      role="alert"
      style={{ fontFamily: readerBodyFont }}
    >
      {streamError}
    </Text>
  );
}

function renderExplainAnalysis(options: {
  analysis: ReaderHighlightAnalysis | null;
  fillAvailableHeight: boolean;
  flowExplanation: boolean;
}): React.ReactNode | null {
  if (!options.analysis || !hasAnalysis(options.analysis)) {
    return null;
  }

  return (
    <Box
      role="status"
      aria-live="polite"
      style={helperStreamStyle({
        fillAvailableHeight: options.fillAvailableHeight,
        flowExplanation: options.flowExplanation,
      })}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {formatAnalysisAsExplanation(options.analysis)}
      </ReactMarkdown>
    </Box>
  );
}

function renderExplainActions(options: {
  onAddToDeck?: () => void;
  canAddToDeck: boolean;
  isExplaining: boolean;
  isDeletingHighlight: boolean;
  isAddingToDeck: boolean;
  canDeleteHighlight: boolean;
  onDeleteHighlight?: () => void;
  canRetryHighlight: boolean;
  onRetryHighlight?: () => void;
  isRetryingHighlight: boolean;
}): React.ReactNode | null {
  const actionState = resolveExplainActionState(options);
  if (
    !actionState.showAddAction &&
    !actionState.showDeleteAction &&
    !actionState.showRetryAction
  ) {
    return null;
  }

  return (
    <Group justify="flex-end" align="flex-start" gap="xs" wrap="nowrap">
      {renderAddToDeckAction({
        onAddToDeck: options.onAddToDeck,
        actionState,
      })}
      {renderRetryHighlightAction({
        onRetryHighlight: options.onRetryHighlight,
        actionState,
      })}
      {renderDeleteHighlightAction({
        onDeleteHighlight: options.onDeleteHighlight,
        actionState,
      })}
    </Group>
  );
}

function renderAddToDeckAction(options: {
  onAddToDeck?: () => void;
  actionState: ReturnType<typeof resolveExplainActionState>;
}): React.ReactNode | null {
  if (!options.actionState.showAddAction || !options.onAddToDeck) {
    return null;
  }

  return (
    <Button
      size="compact-sm"
      variant="light"
      color="grape"
      onClick={options.onAddToDeck}
      disabled={options.actionState.addDisabled}
      loading={options.actionState.isAddingToDeck}
    >
      Add to deck
    </Button>
  );
}

function renderRetryHighlightAction(options: {
  onRetryHighlight?: () => void;
  actionState: ReturnType<typeof resolveExplainActionState>;
}): React.ReactNode | null {
  if (!options.actionState.showRetryAction || !options.onRetryHighlight) {
    return null;
  }

  return (
    <ActionIcon
      size="sm"
      variant="subtle"
      color="gray"
      onClick={options.onRetryHighlight}
      disabled={options.actionState.retryDisabled}
      aria-label="Retry highlight"
    >
      {options.actionState.isRetryingHighlight ? (
        <Loader size={12} />
      ) : (
        <IconRefresh size={14} stroke={1.8} />
      )}
    </ActionIcon>
  );
}

function renderDeleteHighlightAction(options: {
  onDeleteHighlight?: () => void;
  actionState: ReturnType<typeof resolveExplainActionState>;
}): React.ReactNode | null {
  if (
    !options.actionState.showDeleteAction ||
    !options.onDeleteHighlight
  ) {
    return null;
  }

  return (
    <ActionIcon
      size="sm"
      variant="subtle"
      color="gray"
      onClick={options.onDeleteHighlight}
      disabled={options.actionState.deleteDisabled}
      aria-label="Delete highlight"
    >
      {options.actionState.isDeletingHighlight ? (
        <Loader size={12} />
      ) : (
        <IconX size={14} stroke={1.8} />
      )}
    </ActionIcon>
  );
}

export function ExplainSelectionCard({
  isExplaining,
  streamError,
  analysis,
  onDeleteHighlight,
  canDeleteHighlight = false,
  isDeletingHighlight = false,
  onRetryHighlight,
  canRetryHighlight = false,
  isRetryingHighlight = false,
  onAddToDeck,
  canAddToDeck = false,
  isAddingToDeck = false,
  fillAvailableHeight = false,
  flowExplanation = false,
}: ExplainSelectionCardProps) {
  const actions = renderExplainActions({
    onAddToDeck,
    canAddToDeck,
    isExplaining,
    isDeletingHighlight,
    isAddingToDeck,
    canDeleteHighlight,
    onDeleteHighlight,
    canRetryHighlight,
    onRetryHighlight,
    isRetryingHighlight,
  });
  const explanation = renderExplainAnalysis({
    analysis,
    fillAvailableHeight,
    flowExplanation,
  });

  if (flowExplanation) {
    return (
      <Stack gap="sm" style={helperPanelStyle(fillAvailableHeight)}>
        {renderExplainLoading(isExplaining)}
        {renderExplainError(streamError)}
        {actions}
        {explanation}
      </Stack>
    );
  }

  return (
    <Stack gap="sm" style={helperPanelStyle(fillAvailableHeight)}>
      {renderExplainLoading(isExplaining)}
      {renderExplainError(streamError)}
      {actions}
      {explanation}
    </Stack>
  );
}

type HighlightsHistoryCardProps = {
  highlights: ReaderHighlight[];
  isLoading: boolean;
  errorMessage: string;
  actions?: React.ReactNode;
  hideActions?: boolean;
  deletingHighlightId: number | null;
  selectedHighlightIds: number[];
  onToggleHighlightSelection: (
    highlightId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  canImportSelected: boolean;
  isImportingSelected: boolean;
  onToggleSelectAll: () => void;
  canSelectAll: boolean;
  allImportableSelected: boolean;
  importStatusByHighlightId: Record<number, ReaderHighlightImportStatus>;
  onDeleteHighlight: (highlightId: number) => void;
  onOpenHighlight?: (highlight: ReaderHighlight) => void;
};

type HighlightHistoryRowProps = {
  highlight: ReaderHighlight;
  isDeleting: boolean;
  isSelected: boolean;
  onToggleSelected: (next: boolean) => void;
  importStatus: ReaderHighlightImportStatus | null;
  onDeleteHighlight: (highlightId: number) => void;
  onOpenHighlight?: (highlight: ReaderHighlight) => void;
};

type HighlightHistoryOpenState = {
  cursor?: React.CSSProperties["cursor"];
  rowProps: {
    onClick?: () => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
    role?: "button";
    tabIndex?: number;
  };
};

function resolveHighlightHistoryOpenState(options: {
  highlight: ReaderHighlight;
  onOpenHighlight?: (highlight: ReaderHighlight) => void;
}): HighlightHistoryOpenState {
  if (!options.onOpenHighlight) {
    return { rowProps: {} };
  }

  const openHighlight = () => {
    options.onOpenHighlight?.(options.highlight);
  };

  return {
    cursor: "pointer",
    rowProps: {
      role: "button",
      tabIndex: 0,
      onClick: openHighlight,
      onKeyDown: (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        openHighlight();
      },
    },
  };
}

function HighlightHistoryRow({
  highlight,
  isDeleting,
  isSelected,
  onToggleSelected,
  importStatus,
  onDeleteHighlight,
  onOpenHighlight,
}: HighlightHistoryRowProps) {
  const [showExplanation, setShowExplanation] = React.useState(false);
  const rowState = resolveHighlightRowState(
    highlight,
    importStatus,
    showExplanation,
  );
  const openState = resolveHighlightHistoryOpenState({
    highlight,
    onOpenHighlight,
  });

  return (
    <Stack
      gap={4}
      {...openState.rowProps}
      style={{
        borderBottom: `1px solid ${readerDividerColor}`,
        paddingBottom: 7,
        cursor: openState.cursor,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group
          align="flex-start"
          gap={8}
          wrap="nowrap"
          style={{
            minWidth: 0,
            flex: "1 1 auto",
          }}
        >
          <Checkbox
            checked={isSelected}
            onChange={(event) => {
              onToggleSelected(event.currentTarget.checked);
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            disabled={!rowState.canSelect}
            mt={2}
            aria-label={`Select highlight ${highlight.selectedText}`}
          />
          <Stack gap={2} style={{ minWidth: 0, flex: "1 1 auto" }}>
            <Group gap={6} wrap="wrap">
              <Text
                fw={700}
                style={{
                  fontFamily: readerBodyFont,
                  color: readerHeadingColor,
                  minWidth: 0,
                  flex: "1 1 auto",
                }}
              >
                {highlight.selectedText}
              </Text>
              {rowState.badgeMeta ? (
                <Badge
                  size="xs"
                  variant="light"
                  color={rowState.badgeMeta.color}
                >
                  {rowState.badgeMeta.label}
                </Badge>
              ) : null}
            </Group>
            {rowState.definitionPreview ? (
              <Text
                size="sm"
                c="dimmed"
                lineClamp={2}
                style={{
                  fontFamily: readerBodyFont,
                  overflowWrap: "anywhere",
                }}
              >
                {rowState.definitionPreview}
              </Text>
            ) : null}
          </Stack>
        </Group>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteHighlight(highlight.id);
          }}
          disabled={isDeleting}
          aria-label="Delete highlight"
        >
          {isDeleting ? (
            <Loader size={12} />
          ) : (
            <IconX size={14} stroke={1.8} />
          )}
        </ActionIcon>
      </Group>
      <Text size="xs" c="dimmed" style={{ fontFamily: readerBodyFont }}>
        {rowState.metaLine}
      </Text>
      {rowState.showErrorMessage ? (
        <Text size="sm" c="red" style={{ fontFamily: readerBodyFont }}>
          {highlight.errorMessage}
        </Text>
      ) : null}
      {rowState.highlightHasAnalysis ? (
        <Group gap="xs" justify="space-between">
          <Button
            size="compact-xs"
            variant="subtle"
            color="grape"
            onClick={(event) => {
              event.stopPropagation();
              setShowExplanation((previous) => !previous);
            }}
          >
            {rowState.toggleLabel}
          </Button>
        </Group>
      ) : null}
      {rowState.highlightHasAnalysis && showExplanation ? (
        <Box
          style={{
            borderLeft: `2px solid ${readerDividerColor}`,
            paddingLeft: 10,
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {formatAnalysisAsExplanation(rowState.analysis)}
          </ReactMarkdown>
        </Box>
      ) : null}
    </Stack>
  );
}

export function HighlightsHistoryCard({
  highlights,
  isLoading,
  errorMessage,
  actions,
  hideActions = false,
  deletingHighlightId,
  selectedHighlightIds,
  onToggleHighlightSelection,
  onImportSelected,
  canImportSelected,
  isImportingSelected,
  onToggleSelectAll,
  canSelectAll,
  allImportableSelected,
  importStatusByHighlightId,
  onDeleteHighlight,
  onOpenHighlight,
}: HighlightsHistoryCardProps) {
  const [showAll, setShowAll] = React.useState(false);
  const historyState = resolveHighlightsHistoryState({
    isLoading,
    errorMessage,
    highlightCount: highlights.length,
  });
  const visibility = resolveHighlightsVisibility(highlights, showAll);

  return (
    <Stack gap="sm">
      <HighlightsLoading isLoading={isLoading} />
      {historyState.showError ? (
        <Text
          size="sm"
          c="red"
          role="alert"
          style={{ fontFamily: readerBodyFont }}
        >
          {errorMessage}
        </Text>
      ) : null}
      {historyState.showEmpty ? (
        <Text size="sm" c="dimmed" style={{ fontFamily: readerBodyFont }}>
          No highlights saved yet.
        </Text>
      ) : null}
      {historyState.showList ? (
        <Stack gap="sm">
          {hideActions
            ? null
            : (actions ?? (
                <Group>
                  <Button
                    size="compact-sm"
                    color="grape"
                    onClick={onImportSelected}
                    disabled={!canImportSelected}
                    loading={isImportingSelected}
                  >
                    Add to deck
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    color="grape"
                    onClick={onToggleSelectAll}
                    disabled={!canSelectAll}
                  >
                    {allImportableSelected ? "Clear all" : "Select all"}
                  </Button>
                </Group>
              ))}
          {visibility.visibleHighlights.map((highlight) => {
            return (
              <HighlightHistoryRow
                key={highlight.id}
                highlight={highlight}
                isDeleting={deletingHighlightId === highlight.id}
                isSelected={selectedHighlightIds.includes(highlight.id)}
                onToggleSelected={(next) => {
                  onToggleHighlightSelection(highlight.id, next);
                }}
                importStatus={
                  importStatusByHighlightId[highlight.id] ?? null
                }
                onDeleteHighlight={onDeleteHighlight}
                onOpenHighlight={onOpenHighlight}
              />
            );
          })}
          {visibility.canExpand ? (
            <Group>
              <Button
                size="compact-sm"
                variant="subtle"
                color="grape"
                onClick={() => {
                  setShowAll(true);
                }}
              >
                Show {visibility.hiddenCount} more
              </Button>
            </Group>
          ) : null}
          {visibility.canCollapse ? (
            <Group>
              <Button
                size="compact-sm"
                variant="subtle"
                color="gray"
                onClick={() => {
                  setShowAll(false);
                }}
              >
                Show fewer
              </Button>
            </Group>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

function HighlightsLoading({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }

  return (
    <Group gap="xs" align="center" role="status" aria-live="polite">
      <Loader size="xs" color="grape" />
      <Text size="sm" c="dimmed" style={{ fontFamily: readerBodyFont }}>
        Loading highlights...
      </Text>
    </Group>
  );
}
