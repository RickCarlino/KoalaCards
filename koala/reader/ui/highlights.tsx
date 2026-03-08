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
import { IconX } from "@tabler/icons-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  readerBodyFont,
  readerDividerColor,
  readerFloatingBackgroundColor,
  readerFloatingBorderColor,
  readerFloatingShadow,
  readerHeadingColor,
} from "./theme";

export type ReaderHighlightStatus = "in_progress" | "ready" | "error";

export type ReaderHighlightAnalysis = {
  term: string;
  definition: string;
  generalMeaning: string;
  meaningInContext: string;
};

export type HighlightImportResultStatus =
  | "created"
  | "duplicate"
  | "already_imported"
  | "not_ready"
  | "missing";

export type ReaderArticleHighlight = ReaderHighlightAnalysis & {
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
};

type ExplainSelectionCardProps = {
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  onDeleteHighlight?: () => void;
  canDeleteHighlight?: boolean;
  isDeletingHighlight?: boolean;
  onAddToDeck?: () => void;
  canAddToDeck?: boolean;
  isAddingToDeck?: boolean;
  fillAvailableHeight?: boolean;
};

type SelectionActionBubbleProps = {
  isVisible: boolean;
  top: number;
  left: number;
  isExplaining: boolean;
  onExplain: () => void;
};

type ContextSummaryParts = {
  before: string;
  match: string;
  after: string;
};

function normalizeContextChunk(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compactContextSummary(
  highlight: ReaderArticleHighlight,
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
  highlight: ReaderArticleHighlight,
  timestamp: string,
): string {
  const occurrenceText = `Occurrence ${highlight.selectedOccurrenceIndex + 1} of ${highlight.occurrenceCount}`;
  if (!timestamp) {
    return occurrenceText;
  }

  return `${occurrenceText} • ${timestamp}`;
}

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

function helperStreamStyle(
  fillAvailableHeight: boolean,
): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    borderLeft: `2px solid ${readerDividerColor}`,
    paddingLeft: 10,
    paddingRight: 4,
    paddingBottom: 4,
    overflowY: "auto",
  };

  if (!fillAvailableHeight) {
    return {
      ...baseStyle,
      maxHeight: 220,
    };
  }

  return {
    ...baseStyle,
    flex: "1 1 auto",
    minHeight: 0,
  };
}

function hasAnalysis(analysis: ReaderHighlightAnalysis | null): boolean {
  if (!analysis) {
    return false;
  }

  return (
    analysis.definition.trim().length > 0 &&
    analysis.generalMeaning.trim().length > 0 &&
    analysis.meaningInContext.trim().length > 0
  );
}

function formatAnalysisAsExplanation(
  analysis: ReaderHighlightAnalysis,
): string {
  return [
    `${analysis.term}: ${analysis.definition}`,
    "",
    analysis.generalMeaning,
    "",
    analysis.meaningInContext,
  ].join("\n");
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
}): React.ReactNode | null {
  if (!options.analysis || !hasAnalysis(options.analysis)) {
    return null;
  }

  return (
    <Box
      role="status"
      aria-live="polite"
      style={helperStreamStyle(options.fillAvailableHeight)}
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
}): React.ReactNode | null {
  const showAddAction = Boolean(options.onAddToDeck);
  const showDeleteAction = Boolean(options.onDeleteHighlight);

  if (!showAddAction && !showDeleteAction) {
    return null;
  }

  return (
    <Group justify="flex-end">
      {showAddAction && options.onAddToDeck && (
        <Button
          size="compact-sm"
          variant="light"
          color="grape"
          onClick={options.onAddToDeck}
          disabled={
            !options.canAddToDeck ||
            options.isExplaining ||
            options.isDeletingHighlight
          }
          loading={options.isAddingToDeck}
        >
          Add to deck
        </Button>
      )}
      {showDeleteAction && options.onDeleteHighlight && (
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          onClick={options.onDeleteHighlight}
          disabled={
            !options.canDeleteHighlight ||
            options.isDeletingHighlight ||
            options.isExplaining
          }
          aria-label="Delete highlight"
        >
          {options.isDeletingHighlight ? (
            <Loader size={12} />
          ) : (
            <IconX size={14} stroke={1.8} />
          )}
        </ActionIcon>
      )}
    </Group>
  );
}

export function SelectionActionBubble({
  isVisible,
  top,
  left,
  isExplaining,
  onExplain,
}: SelectionActionBubbleProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <Box
      style={{
        position: "fixed",
        top,
        left,
        transform: "translate(-50%, calc(-100% - 10px))",
        zIndex: 500,
        borderRadius: 999,
        border: `1px solid ${readerFloatingBorderColor}`,
        background: readerFloatingBackgroundColor,
        boxShadow: readerFloatingShadow,
        padding: 6,
      }}
    >
      <Button
        size="xs"
        color="grape"
        radius="xl"
        loading={isExplaining}
        disabled={isExplaining}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={onExplain}
      >
        Explain
      </Button>
    </Box>
  );
}

export function ExplainSelectionCard({
  isExplaining,
  streamError,
  analysis,
  onDeleteHighlight,
  canDeleteHighlight = false,
  isDeletingHighlight = false,
  onAddToDeck,
  canAddToDeck = false,
  isAddingToDeck = false,
  fillAvailableHeight = false,
}: ExplainSelectionCardProps) {
  return (
    <Stack gap="sm" style={helperPanelStyle(fillAvailableHeight)}>
      {renderExplainActions({
        onAddToDeck,
        canAddToDeck,
        isExplaining,
        isDeletingHighlight,
        isAddingToDeck,
        canDeleteHighlight,
        onDeleteHighlight,
      })}
      {renderExplainLoading(isExplaining)}
      {renderExplainError(streamError)}
      {renderExplainAnalysis({ analysis, fillAvailableHeight })}
    </Stack>
  );
}

type HighlightsHistoryCardProps = {
  highlights: ReaderArticleHighlight[];
  isLoading: boolean;
  errorMessage: string;
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
  importStatusByHighlightId: Record<number, HighlightImportResultStatus>;
  onDeleteHighlight: (highlightId: number) => void;
};

type HighlightHistoryRowProps = {
  highlight: ReaderArticleHighlight;
  isDeleting: boolean;
  isSelected: boolean;
  onToggleSelected: (next: boolean) => void;
  importStatus: HighlightImportResultStatus | null;
  onDeleteHighlight: (highlightId: number) => void;
};

type HighlightBadgeMeta = {
  label: string;
  color: string;
};

function resolveHighlightBadgeMeta(
  highlight: ReaderArticleHighlight,
  importStatus: HighlightImportResultStatus | null,
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

function HighlightHistoryRow({
  highlight,
  isDeleting,
  isSelected,
  onToggleSelected,
  importStatus,
  onDeleteHighlight,
}: HighlightHistoryRowProps) {
  const [showExplanation, setShowExplanation] = React.useState(false);
  const contextSummary = compactContextSummary(highlight);
  const hasContextSummary =
    contextSummary.before.length > 0 ||
    contextSummary.match.length > 0 ||
    contextSummary.after.length > 0;
  const timestamp = formatHighlightTimestamp(highlight.createdAt);
  const metaLine = buildHighlightMetaLine(highlight, timestamp);
  const analysis: ReaderHighlightAnalysis = {
    term: highlight.term,
    definition: highlight.definition,
    generalMeaning: highlight.generalMeaning,
    meaningInContext: highlight.meaningInContext,
  };
  const highlightHasAnalysis =
    highlight.status === "ready" && hasAnalysis(analysis);
  const canSelect =
    highlight.status === "ready" && highlight.importedCardId === null;
  const badgeMeta = resolveHighlightBadgeMeta(highlight, importStatus);

  let toggleLabel = "Show explanation";
  if (showExplanation) {
    toggleLabel = "Hide explanation";
  }

  return (
    <Stack
      gap={4}
      style={{
        borderBottom: `1px solid ${readerDividerColor}`,
        paddingBottom: 7,
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
            disabled={!canSelect}
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
              {badgeMeta && (
                <Badge size="xs" variant="light" color={badgeMeta.color}>
                  {badgeMeta.label}
                </Badge>
              )}
            </Group>
          </Stack>
        </Group>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          onClick={() => {
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
        {metaLine}
      </Text>
      {hasContextSummary && (
        <Text size="xs" c="dimmed" style={{ fontFamily: readerBodyFont }}>
          {contextSummary.before}
          <Text
            component="span"
            fw={700}
            c={readerHeadingColor}
            style={{ fontFamily: readerBodyFont }}
          >
            {contextSummary.match}
          </Text>
          {contextSummary.after}
        </Text>
      )}
      {highlight.status === "error" &&
        highlight.errorMessage.trim().length > 0 && (
          <Text size="sm" c="red" style={{ fontFamily: readerBodyFont }}>
            {highlight.errorMessage}
          </Text>
        )}
      {highlightHasAnalysis && (
        <Group gap="xs" justify="space-between">
          <Button
            size="compact-xs"
            variant="subtle"
            color="grape"
            onClick={() => {
              setShowExplanation((previous) => !previous);
            }}
          >
            {toggleLabel}
          </Button>
        </Group>
      )}
      {highlightHasAnalysis && showExplanation && (
        <Box
          style={{
            borderLeft: `2px solid ${readerDividerColor}`,
            paddingLeft: 10,
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {formatAnalysisAsExplanation(analysis)}
          </ReactMarkdown>
        </Box>
      )}
    </Stack>
  );
}

export function HighlightsHistoryCard({
  highlights,
  isLoading,
  errorMessage,
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
}: HighlightsHistoryCardProps) {
  const [showAll, setShowAll] = React.useState(false);

  let visibleHighlights = highlights.slice(0, 4);
  if (showAll) {
    visibleHighlights = highlights;
  }

  const hiddenCount = highlights.length - visibleHighlights.length;
  const canExpand = hiddenCount > 0;

  return (
    <Stack gap="sm">
      {isLoading && (
        <Group gap="xs" align="center" role="status" aria-live="polite">
          <Loader size="xs" color="grape" />
          <Text
            size="sm"
            c="dimmed"
            style={{ fontFamily: readerBodyFont }}
          >
            Loading highlights...
          </Text>
        </Group>
      )}
      {!isLoading && errorMessage.trim().length > 0 && (
        <Text
          size="sm"
          c="red"
          role="alert"
          style={{ fontFamily: readerBodyFont }}
        >
          {errorMessage}
        </Text>
      )}
      {!isLoading &&
        errorMessage.trim().length === 0 &&
        highlights.length === 0 && (
          <Text
            size="sm"
            c="dimmed"
            style={{ fontFamily: readerBodyFont }}
          >
            No highlights saved yet.
          </Text>
        )}
      {!isLoading && highlights.length > 0 && (
        <Stack gap="sm">
          <Group>
            <Button
              size="compact-sm"
              color="grape"
              onClick={onImportSelected}
              disabled={!canImportSelected}
              loading={isImportingSelected}
            >
              Import
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
          {visibleHighlights.map((highlight) => {
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
              />
            );
          })}
          {canExpand && (
            <Group>
              <Button
                size="compact-sm"
                variant="subtle"
                color="grape"
                onClick={() => {
                  setShowAll(true);
                }}
              >
                Show {hiddenCount} more
              </Button>
            </Group>
          )}
          {showAll && highlights.length > 4 && (
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
          )}
        </Stack>
      )}
    </Stack>
  );
}
