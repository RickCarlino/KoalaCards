import {
  ActionIcon,
  Box,
  Button,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { IconX } from "@tabler/icons-react";
import { ReaderPanelHeader } from "./layout";
import { readerBodyFont } from "./theme";

export type ReaderHighlightStatus = "in_progress" | "ready" | "error";

export type ReaderArticleHighlight = {
  id: number;
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrenceCount: number;
  status: ReaderHighlightStatus;
  explanationMarkdown: string;
  errorMessage: string;
  contextBefore: string;
  contextAfter: string;
  createdAt: Date;
  updatedAt: Date;
};

type ExplainSelectionCardProps = {
  isExplaining: boolean;
  streamError: string;
  streamText: string;
  onDeleteHighlight?: () => void;
  canDeleteHighlight?: boolean;
  isDeletingHighlight?: boolean;
  fillAvailableHeight?: boolean;
};

type SelectionActionBubbleProps = {
  isVisible: boolean;
  top: number;
  left: number;
  isExplaining: boolean;
  onExplain: () => void;
};

function compactContextSummary(highlight: ReaderArticleHighlight): string {
  const joined =
    `${highlight.contextBefore}${highlight.selectedText}${highlight.contextAfter}`
      .replace(/\s+/g, " ")
      .trim();

  if (joined.length <= 200) {
    return joined;
  }

  return `${joined.slice(0, 197)}...`;
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
    borderLeft: "2px solid #ead3de",
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
        border: "1px solid #e8bfd3",
        background: "rgba(255, 252, 254, 0.98)",
        boxShadow: "0 12px 26px rgba(162, 93, 125, 0.2)",
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
  streamText,
  onDeleteHighlight,
  canDeleteHighlight = false,
  isDeletingHighlight = false,
  fillAvailableHeight = false,
}: ExplainSelectionCardProps) {
  return (
    <Stack gap="sm" style={helperPanelStyle(fillAvailableHeight)}>
      {isExplaining && (
        <Group gap="xs" align="center" role="status" aria-live="polite">
          <Loader size="xs" color="grape" />
          <Text
            size="sm"
            c="dimmed"
            style={{ fontFamily: readerBodyFont }}
          >
            Streaming explanation...
          </Text>
        </Group>
      )}
      {streamError.trim().length > 0 && (
        <Text
          size="sm"
          c="red"
          role="alert"
          style={{ fontFamily: readerBodyFont }}
        >
          {streamError}
        </Text>
      )}
      {streamText.trim().length > 0 && (
        <Box
          role="status"
          aria-live="polite"
          style={helperStreamStyle(fillAvailableHeight)}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {streamText}
          </ReactMarkdown>
        </Box>
      )}
      {canDeleteHighlight && onDeleteHighlight && (
        <Group justify="flex-end">
          <Button
            size="compact-sm"
            variant="subtle"
            color="gray"
            onClick={onDeleteHighlight}
            disabled={isDeletingHighlight || isExplaining}
            loading={isDeletingHighlight}
          >
            Remove
          </Button>
        </Group>
      )}
    </Stack>
  );
}

type HighlightsHistoryCardProps = {
  highlights: ReaderArticleHighlight[];
  isLoading: boolean;
  errorMessage: string;
  deletingHighlightId: number | null;
  onDeleteHighlight: (highlightId: number) => void;
};

type HighlightHistoryRowProps = {
  highlight: ReaderArticleHighlight;
  isDeleting: boolean;
  onDeleteHighlight: (highlightId: number) => void;
};

function HighlightHistoryRow({
  highlight,
  isDeleting,
  onDeleteHighlight,
}: HighlightHistoryRowProps) {
  const [showExplanation, setShowExplanation] = React.useState(false);
  const contextSummary = compactContextSummary(highlight);
  const timestamp = formatHighlightTimestamp(highlight.createdAt);
  const metaLine = buildHighlightMetaLine(highlight, timestamp);

  const hasExplanation =
    highlight.status === "ready" &&
    highlight.explanationMarkdown.trim().length > 0;

  let toggleLabel = "Show explanation";
  if (showExplanation) {
    toggleLabel = "Hide explanation";
  }

  return (
    <Stack
      gap={4}
      style={{
        borderBottom: "1px solid #efdbe5",
        paddingBottom: 7,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text
          fw={700}
          style={{
            fontFamily: readerBodyFont,
            color: "#5b3f4d",
            minWidth: 0,
            flex: "1 1 auto",
          }}
        >
          {highlight.selectedText}
        </Text>
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
      {contextSummary.length > 0 && (
        <Text size="xs" c="dimmed" style={{ fontFamily: readerBodyFont }}>
          {contextSummary}
        </Text>
      )}
      {highlight.status === "error" &&
        highlight.errorMessage.trim().length > 0 && (
          <Text size="sm" c="red" style={{ fontFamily: readerBodyFont }}>
            {highlight.errorMessage}
          </Text>
        )}
      {hasExplanation && (
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
      {hasExplanation && showExplanation && (
        <Box
          style={{
            borderLeft: "2px solid #ecd8e2",
            paddingLeft: 10,
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {highlight.explanationMarkdown}
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
      <ReaderPanelHeader title="Saved Highlights" />
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
          {visibleHighlights.map((highlight) => {
            return (
              <HighlightHistoryRow
                key={highlight.id}
                highlight={highlight}
                isDeleting={deletingHighlightId === highlight.id}
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
