import { prismaClient } from "@/koala/prisma-client";
import {
  applyRenderedArticleHighlights,
  clearRenderedArticleHighlights,
} from "@/koala/reader/article-highlight-dom";
import {
  buildSavedArticleHighlightRanges,
  type SavedArticleHighlightForRender,
} from "@/koala/reader/article-highlight-ranges";
import {
  ReaderPanel,
  ReaderSplitWorkspace,
} from "@/koala/reader/ui/layout";
import {
  ExplainSelectionCard,
  HighlightsHistoryCard,
  SelectionActionBubble,
  type HighlightImportResultStatus,
  type ReaderHighlightAnalysis,
  type ReaderArticleHighlight,
} from "@/koala/reader/ui/highlights";
import {
  formatReaderDateTime,
  readerBodyFont,
  readerDisplayFont,
  readerDividerColor,
  readerHeadingColor,
  readerPanelBorderColor,
  readerSubtleBackgroundColor,
  readerFrameShadow,
} from "@/koala/reader/ui/theme";
import { trpc } from "@/koala/trpc-config";
import { notifications } from "@mantine/notifications";
import {
  Anchor,
  Box,
  Group,
  Select,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import { getSession } from "next-auth/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ReaderInputKind = "url" | "raw";
type ReaderCodeLineMode = "scroll" | "wrap";

type PublicReaderArticle = {
  publicId: string;
  title: string;
  normalizedUrl: string | null;
  inputKind: ReaderInputKind;
  contentText: string;
  ingestStatus: "pending" | "in_progress" | "ready" | "error";
  ingestError: string;
  createdAt: string;
  viewerIsOwner: boolean;
  decks: Array<{
    id: number;
    name: string;
  }>;
};

type ReaderSelectionDraft = {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  occurrenceHint: number;
  actionTop: number;
  actionLeft: number;
};

type StreamHandlers = {
  onAnalysis: (analysis: ReaderHighlightAnalysis) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

type HelperDraft = {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  occurrenceHint: number;
};

const SELECTION_CONTEXT_RADIUS = 60;
const readerWorkspacePaddingTop = "clamp(10px, 1.5vw, 18px)";
const readerWorkspacePaddingBottom = "clamp(16px, 2.6vw, 30px)";
const readerToolsTopOffset =
  "calc(var(--app-shell-header-offset, 60px) + 12px)";
const readerToolsViewportSafetyMargin = "5svh";
const readerToolsViewportHeight = `calc(100svh - ${readerToolsTopOffset} - ${readerWorkspacePaddingBottom})`;
const readerToolsViewportHeightWithMargin = `calc(${readerToolsViewportHeight} - ${readerToolsViewportSafetyMargin})`;
const readerWorkspaceStyle = {
  width: "100%",
  paddingInline: "clamp(10px, 2.2vw, 28px)",
  paddingTop: readerWorkspacePaddingTop,
  paddingBottom: readerWorkspacePaddingBottom,
};
const readerToolsRailStyle = {
  width: "100%",
  height: readerToolsViewportHeightWithMargin,
  maxHeight: readerToolsViewportHeightWithMargin,
  minHeight: 0,
  display: "flex",
  flexDirection: "column" as const,
  minWidth: 0,
  overflow: "hidden" as const,
};
const readerToolsPanelStyle = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column" as const,
  overflow: "hidden" as const,
  boxSizing: "border-box" as const,
  maxWidth: "100%",
};
const readerToolsSwitchStyle = {
  padding: 0,
  flex: "0 0 auto",
};
const readerToolsContentStyle = {
  minHeight: 0,
  flex: "1 1 auto",
  display: "flex",
  flexDirection: "column" as const,
};
const readerToolsScrollableContentStyle = {
  ...readerToolsContentStyle,
  overflowY: "auto" as const,
  paddingRight: 4,
};
const readerToolsBodyFillStyle = {
  minHeight: 0,
  display: "flex",
  flexDirection: "column" as const,
  overflow: "hidden" as const,
};

function normalizeMarkdownText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeInlineWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function commonPrefixLength(left: string, right: string): number {
  const maxLength = Math.min(left.length, right.length);
  let matched = 0;

  while (matched < maxLength && left[matched] === right[matched]) {
    matched += 1;
  }

  return matched;
}

function commonSuffixLength(left: string, right: string): number {
  const maxLength = Math.min(left.length, right.length);
  let matched = 0;

  while (
    matched < maxLength &&
    left[left.length - 1 - matched] === right[right.length - 1 - matched]
  ) {
    matched += 1;
  }

  return matched;
}

function contentLikelyHasCodeBlocks(value: string): boolean {
  if (value.includes("```") || value.includes("~~~")) {
    return true;
  }

  return /\n {4}\S/.test(value);
}

function removeLeadingBlankLines(lines: string[]): string[] {
  let cursor = 0;
  while (cursor < lines.length && lines[cursor].trim().length === 0) {
    cursor += 1;
  }

  return lines.slice(cursor);
}

function stripLeadingTitleFromMarkdown(
  contentText: string,
  articleTitle: string,
): string {
  const lines = contentText.replace(/\r\n/g, "\n").split("\n");
  const trimmedLines = removeLeadingBlankLines(lines);
  if (trimmedLines.length === 0) {
    return contentText;
  }

  const normalizedTitle = normalizeComparableText(articleTitle);
  if (!normalizedTitle) {
    return contentText;
  }

  const firstLine = trimmedLines[0].trim();
  const markdownHeadingMatch = firstLine.match(/^#{1,6}\s+(.+)$/);
  if (markdownHeadingMatch) {
    const headingText = normalizeComparableText(markdownHeadingMatch[1]);
    if (headingText === normalizedTitle) {
      const remainder = removeLeadingBlankLines(trimmedLines.slice(1));
      return remainder.join("\n");
    }
  }

  const plainFirstLine = normalizeComparableText(firstLine);
  if (plainFirstLine !== normalizedTitle) {
    return contentText;
  }

  if (trimmedLines.length > 1) {
    const secondLine = trimmedLines[1].trim();
    const isUnderlineHeading = /^[-=]{3,}$/.test(secondLine);
    if (isUnderlineHeading) {
      const remainder = removeLeadingBlankLines(trimmedLines.slice(2));
      return remainder.join("\n");
    }
  }

  const remainder = removeLeadingBlankLines(trimmedLines.slice(1));
  return remainder.join("\n");
}

function pendingMessage(status: "pending" | "in_progress"): string {
  if (status === "pending") {
    return "This article is in line to be prepared.";
  }

  return "This article is being prepared now.";
}

function countOverlappingOccurrences(
  text: string,
  phrase: string,
): number {
  if (!phrase) {
    return 0;
  }

  let count = 0;
  let cursor = 0;

  while (cursor <= text.length - phrase.length) {
    const nextIndex = text.indexOf(phrase, cursor);
    if (nextIndex < 0) {
      break;
    }

    count += 1;
    cursor = nextIndex + 1;
  }

  return count;
}

function clampToViewport(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (value < minimum) {
    return minimum;
  }

  if (value > maximum) {
    return maximum;
  }

  return value;
}

function nodeInsideContainer(container: HTMLElement, node: Node): boolean {
  if (node === container) {
    return true;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const parentElement = node.parentElement;
    if (!parentElement) {
      return false;
    }

    return container.contains(parentElement);
  }

  return container.contains(node as HTMLElement);
}

function helperDraftFromHighlight(
  highlight: ReaderArticleHighlight,
): HelperDraft {
  return {
    selectedText: highlight.selectedText,
    contextBefore: highlight.contextBefore,
    contextAfter: highlight.contextAfter,
    occurrenceHint: highlight.selectedOccurrenceIndex,
  };
}

function analysisFromHighlight(
  highlight: ReaderArticleHighlight,
): ReaderHighlightAnalysis | null {
  if (highlight.status !== "ready") {
    return null;
  }

  if (
    highlight.definition.trim().length === 0 ||
    highlight.generalMeaning.trim().length === 0 ||
    highlight.meaningInContext.trim().length === 0
  ) {
    return null;
  }

  return {
    term: highlight.term,
    definition: highlight.definition,
    generalMeaning: highlight.generalMeaning,
    meaningInContext: highlight.meaningInContext,
  };
}

function shouldFillToolsBody(view: HighlightToolsView): boolean {
  return view === "helper";
}

function highlightContextScore(
  highlight: ReaderArticleHighlight,
  draft: HelperDraft,
): number {
  const normalizedHighlightBefore = normalizeInlineWhitespace(
    highlight.contextBefore,
  );
  const normalizedHighlightAfter = normalizeInlineWhitespace(
    highlight.contextAfter,
  );
  const normalizedDraftBefore = normalizeInlineWhitespace(
    draft.contextBefore,
  );
  const normalizedDraftAfter = normalizeInlineWhitespace(
    draft.contextAfter,
  );

  const beforeScore = commonSuffixLength(
    normalizedHighlightBefore,
    normalizedDraftBefore,
  );
  const afterScore = commonPrefixLength(
    normalizedHighlightAfter,
    normalizedDraftAfter,
  );

  return beforeScore + afterScore;
}

function distanceFromOccurrenceHint(
  highlight: ReaderArticleHighlight,
  draft: HelperDraft,
): number {
  return Math.abs(
    highlight.selectedOccurrenceIndex - draft.occurrenceHint,
  );
}

function shouldReplaceBestCandidate(options: {
  candidate: ReaderArticleHighlight;
  candidateScore: number;
  bestCandidate: ReaderArticleHighlight | null;
  bestScore: number;
  draft: HelperDraft;
}): boolean {
  const { candidate, candidateScore, bestCandidate, bestScore, draft } =
    options;

  if (!bestCandidate) {
    return true;
  }

  if (candidateScore > bestScore) {
    return true;
  }

  if (candidateScore < bestScore) {
    return false;
  }

  const candidateDistance = distanceFromOccurrenceHint(candidate, draft);
  const bestDistance = distanceFromOccurrenceHint(bestCandidate, draft);
  if (candidateDistance < bestDistance) {
    return true;
  }

  if (candidateDistance > bestDistance) {
    return false;
  }

  return candidate.createdAt > bestCandidate.createdAt;
}

function findMatchingHighlightId(
  highlights: ReaderArticleHighlight[],
  draft: HelperDraft,
): number | null {
  const normalizedDraftText = normalizeInlineWhitespace(
    draft.selectedText,
  );
  if (normalizedDraftText.length === 0) {
    return null;
  }

  const candidates = highlights.filter((highlight) => {
    return (
      normalizeInlineWhitespace(highlight.selectedText) ===
      normalizedDraftText
    );
  });
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0].id;
  }

  const hintMatch = candidates.find((highlight) => {
    return highlight.selectedOccurrenceIndex === draft.occurrenceHint;
  });

  let bestCandidate: ReaderArticleHighlight | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const candidateScore = highlightContextScore(candidate, draft);
    if (
      shouldReplaceBestCandidate({
        candidate,
        candidateScore,
        bestCandidate,
        bestScore,
        draft,
      })
    ) {
      bestCandidate = candidate;
      bestScore = candidateScore;
    }
  }

  if (bestScore === 0 && hintMatch) {
    return hintMatch.id;
  }

  return bestCandidate?.id ?? hintMatch?.id ?? null;
}

function buildSelectionDraft(
  container: HTMLElement,
): ReaderSelectionDraft | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (
    !nodeInsideContainer(container, range.startContainer) ||
    !nodeInsideContainer(container, range.endContainer)
  ) {
    return null;
  }

  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length > 220) {
    return null;
  }

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(container);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const beforeText = beforeRange.toString();

  const afterRange = document.createRange();
  afterRange.selectNodeContents(container);
  afterRange.setStart(range.endContainer, range.endOffset);
  const afterText = afterRange.toString();

  const contextBefore = beforeText.slice(-SELECTION_CONTEXT_RADIUS);
  const contextAfter = afterText.slice(0, SELECTION_CONTEXT_RADIUS);
  const occurrenceHint = countOverlappingOccurrences(
    beforeText,
    selectedText,
  );
  const rangeRect = range.getBoundingClientRect();
  const viewportPadding = 16;
  const actionLeft = clampToViewport(
    rangeRect.left + rangeRect.width / 2,
    viewportPadding,
    window.innerWidth - viewportPadding,
  );
  const actionTop = clampToViewport(
    rangeRect.top,
    56,
    window.innerHeight - viewportPadding,
  );

  return {
    selectedText,
    contextBefore,
    contextAfter,
    occurrenceHint,
    actionTop,
    actionLeft,
  };
}

async function readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: StreamHandlers,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const shouldStop = handleSseChunk(chunk, handlers);
      if (shouldStop) {
        handlers.onDone();
        finished = true;
        break;
      }
    }
  }

  if (!finished) {
    handlers.onDone();
  }
}

function parseSseChunk(chunk: string): {
  eventName: string | null;
  payload: string;
} {
  let eventName: string | null = null;
  const dataLines: string[] = [];

  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }

  return {
    eventName,
    payload: dataLines.join("\n"),
  };
}

function handleSseChunk(chunk: string, handlers: StreamHandlers): boolean {
  const { eventName, payload } = parseSseChunk(chunk);

  if (eventName === "done") {
    return true;
  }

  if (eventName === "error") {
    handlers.onError(payload || "Streaming failed.");
    return false;
  }

  if (eventName !== "analysis" || payload.length === 0) {
    return false;
  }

  try {
    const parsed = JSON.parse(payload) as ReaderHighlightAnalysis;
    handlers.onAnalysis(parsed);
  } catch {
    handlers.onError("Unable to read structured analysis.");
  }

  return false;
}

const readerArticleBodyStyle = {
  maxWidth: "90ch",
  margin: "0 auto",
  fontFamily: readerDisplayFont,
  lineHeight: 1.85,
  fontSize: "1.07rem",
  color: readerHeadingColor,
};

type ArticleMetaRowProps = {
  article: PublicReaderArticle;
};

function ArticleMetaRow({ article }: ArticleMetaRowProps) {
  return (
    <Group justify="space-between" align="center" wrap="wrap" gap="sm">
      <Text size="xs" c="dimmed" style={{ fontFamily: readerBodyFont }}>
        Added {formatReaderDateTime(new Date(article.createdAt))}
      </Text>
      {article.normalizedUrl && (
        <Anchor
          href={article.normalizedUrl}
          target="_blank"
          rel="noreferrer"
          size="sm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          Source
          <IconExternalLink size={14} stroke={1.8} />
        </Anchor>
      )}
    </Group>
  );
}

function ProcessingCard({
  status,
  ingestError,
}: {
  status: PublicReaderArticle["ingestStatus"];
  ingestError: string;
}) {
  if (status === "ready") {
    return null;
  }

  if (status === "error") {
    return (
      <ReaderPanel>
        <Text c="red" fw={700}>
          This article could not be prepared.
        </Text>
        {ingestError.trim().length > 0 && (
          <Text size="sm" c="red">
            {ingestError}
          </Text>
        )}
        <Text size="sm" c="dimmed">
          Go back to Reading and try adding it again.
        </Text>
      </ReaderPanel>
    );
  }

  return (
    <ReaderPanel>
      <Text c="dimmed">{pendingMessage(status)}</Text>
      <Text size="sm" c="dimmed">
        This page refreshes every few seconds.
      </Text>
    </ReaderPanel>
  );
}

type ReaderArticleBodyProps = {
  contentText: string;
  emptyMessage: string;
  skipHtml?: boolean;
  wrapCodeBlocks?: boolean;
  articleRef?: React.RefObject<HTMLElement>;
};

function ReaderArticleBody({
  contentText,
  emptyMessage,
  skipHtml = false,
  wrapCodeBlocks = false,
  articleRef,
}: ReaderArticleBodyProps) {
  if (!contentText.trim()) {
    return (
      <Box>
        <Text size="sm" c="dimmed">
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <article
        style={readerArticleBodyStyle}
        ref={articleRef}
        data-reader-article="content"
        data-code-wrap={wrapCodeBlocks ? "on" : "off"}
      >
        <ReactMarkdown skipHtml={skipHtml} remarkPlugins={[remarkGfm]}>
          {contentText}
        </ReactMarkdown>
      </article>
    </Box>
  );
}

type OwnerHighlightToolsProps = {
  publicId: string;
  articleRef: React.RefObject<HTMLElement>;
  createdAt: string;
  sourceUrl: string | null;
  decks: PublicReaderArticle["decks"];
  codeLineMode: ReaderCodeLineMode;
  onCodeLineModeChange: (nextMode: ReaderCodeLineMode) => void;
};

type HighlightToolsView = "helper" | "saved" | "extras";

function parseHighlightToolsView(value: string): HighlightToolsView {
  if (value === "saved") {
    return "saved";
  }

  if (value === "extras") {
    return "extras";
  }

  return "helper";
}

function importStatusLabel(status: HighlightImportResultStatus): string {
  if (status === "created") {
    return "Added to deck";
  }

  if (status === "duplicate") {
    return "Duplicate term";
  }

  if (status === "already_imported") {
    return "Already added";
  }

  if (status === "not_ready") {
    return "Not ready";
  }

  return "Not found";
}

function importStatusColor(status: HighlightImportResultStatus): string {
  if (status === "created") {
    return "green";
  }

  if (status === "duplicate" || status === "already_imported") {
    return "gray";
  }

  if (status === "not_ready") {
    return "yellow";
  }

  return "gray";
}

function canAddHighlightToDeck(
  activeHighlight: ReaderArticleHighlight | null,
  selectedDeckId: string | null,
): boolean {
  if (!activeHighlight) {
    return false;
  }

  if (activeHighlight.status !== "ready") {
    return false;
  }

  if (activeHighlight.importedCardId !== null) {
    return false;
  }

  return selectedDeckId !== null;
}

function canImportSelectedHighlights(options: {
  selectedDeckId: string | null;
  importableHighlightCount: number;
  isImportingSelected: boolean;
  isMutationLoading: boolean;
}): boolean {
  if (options.selectedDeckId === null) {
    return false;
  }

  if (options.importableHighlightCount === 0) {
    return false;
  }

  if (options.isImportingSelected) {
    return false;
  }

  return !options.isMutationLoading;
}

function addToDeckHandlerOrUndefined(
  activeHighlight: ReaderArticleHighlight | null,
  handler: () => Promise<void>,
): (() => void) | undefined {
  if (!activeHighlight) {
    return undefined;
  }

  return () => {
    void handler();
  };
}

type ReaderHighlightImportSummary = {
  created: number;
  duplicate: number;
  alreadyImported: number;
  notReady: number;
  missing: number;
};

type ReaderHighlightImportResult = {
  results: Array<{
    highlightId: number;
    status: HighlightImportResultStatus;
  }>;
  summary: ReaderHighlightImportSummary;
};

type ReaderHighlightImportInput = {
  publicId: string;
  selectedDeckId: string | null;
  highlightIds: number[];
  mutateAsync: (input: {
    publicId: string;
    deckId: number;
    highlightIds: number[];
  }) => Promise<ReaderHighlightImportResult>;
};

function parseDeckId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsedDeckId = Number(value);
  if (!Number.isFinite(parsedDeckId)) {
    return null;
  }

  return parsedDeckId;
}

function mergeImportStatuses(
  previous: Record<number, HighlightImportResultStatus>,
  results: ReaderHighlightImportResult["results"],
): Record<number, HighlightImportResultStatus> {
  const next = { ...previous };
  for (const result of results) {
    next[result.highlightId] = result.status;
  }
  return next;
}

function toggleSelectedHighlights(
  previous: number[],
  highlightId: number,
  isSelected: boolean,
): number[] {
  if (isSelected) {
    if (previous.includes(highlightId)) {
      return previous;
    }

    return [...previous, highlightId];
  }

  return previous.filter((id) => id !== highlightId);
}

function toggleAllSelectedHighlights(
  previous: number[],
  importableHighlightIds: number[],
): number[] {
  if (importableHighlightIds.length === 0) {
    return [];
  }

  if (previous.length === importableHighlightIds.length) {
    return [];
  }

  return [...importableHighlightIds];
}

function areAllImportableHighlightsSelected(options: {
  selectedHighlightIds: number[];
  importableHighlightIds: number[];
}): boolean {
  if (options.importableHighlightIds.length === 0) {
    return false;
  }

  return (
    options.selectedHighlightIds.length ===
    options.importableHighlightIds.length
  );
}

function canSelectAllHighlights(options: {
  importableHighlightIds: number[];
  isImportingSelected: boolean;
}): boolean {
  if (options.isImportingSelected) {
    return false;
  }

  return options.importableHighlightIds.length > 0;
}

function importSummaryMessage(
  summary: ReaderHighlightImportSummary,
): string {
  const messageParts: string[] = [];
  if (summary.created > 0) {
    messageParts.push(`${summary.created} added`);
  }
  if (summary.duplicate > 0) {
    messageParts.push(`${summary.duplicate} duplicate`);
  }
  if (summary.alreadyImported > 0) {
    messageParts.push(`${summary.alreadyImported} already added`);
  }
  if (summary.notReady > 0) {
    messageParts.push(`${summary.notReady} not ready`);
  }
  if (summary.missing > 0) {
    messageParts.push(`${summary.missing} missing`);
  }
  if (messageParts.length === 0) {
    return "No changes";
  }

  return messageParts.join(" · ");
}

async function importHighlightsForDeck(
  input: ReaderHighlightImportInput,
): Promise<ReaderHighlightImportResult | null> {
  if (input.highlightIds.length === 0) {
    return null;
  }

  const deckId = parseDeckId(input.selectedDeckId);
  if (deckId === null) {
    return null;
  }

  return input.mutateAsync({
    publicId: input.publicId,
    deckId,
    highlightIds: input.highlightIds,
  });
}

type HighlightInfoCardProps = {
  publicId: string;
  createdAt: string;
  sourceUrl: string | null;
  codeLineMode: ReaderCodeLineMode;
  onCodeLineModeChange: (nextMode: ReaderCodeLineMode) => void;
};

function HighlightInfoCard({
  publicId,
  createdAt,
  sourceUrl,
  codeLineMode,
  onCodeLineModeChange,
}: HighlightInfoCardProps) {
  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" style={{ fontFamily: readerBodyFont }}>
          Code lines
        </Text>
        <SegmentedControl
          aria-label="Code line display mode"
          value={codeLineMode}
          onChange={(nextMode) => {
            onCodeLineModeChange(parseReaderCodeLineMode(nextMode));
          }}
          data={[
            { label: "Scroll long lines", value: "scroll" },
            { label: "Wrap long lines", value: "wrap" },
          ]}
          size="xs"
          radius="xl"
          color="grape"
        />
      </Stack>
      <Stack gap={4}>
        <Text size="xs" c="dimmed" style={{ fontFamily: readerBodyFont }}>
          Added
        </Text>
        <Text size="sm" style={{ fontFamily: readerBodyFont }}>
          {formatReaderDateTime(new Date(createdAt))}
        </Text>
      </Stack>
      <Stack gap={4}>
        <Text size="xs" c="dimmed" style={{ fontFamily: readerBodyFont }}>
          Source
        </Text>
        {sourceUrl ? (
          <Anchor
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            size="sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            Open source page
            <IconExternalLink size={14} stroke={1.8} />
          </Anchor>
        ) : (
          <Text
            size="sm"
            c="dimmed"
            style={{ fontFamily: readerBodyFont }}
          >
            No source link available.
          </Text>
        )}
      </Stack>
      <Anchor href={`/reader/${publicId}/typing`} size="sm">
        Typing practice
      </Anchor>
    </Stack>
  );
}

function OwnerHighlightTools({
  publicId,
  articleRef,
  createdAt,
  sourceUrl,
  decks,
  codeLineMode,
  onCodeLineModeChange,
}: OwnerHighlightToolsProps) {
  const [selectionDraft, setSelectionDraft] =
    useState<ReaderSelectionDraft | null>(null);
  const [helperDraftOverride, setHelperDraftOverride] =
    useState<HelperDraft | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<
    number | null
  >(null);
  const [activeAnalysis, setActiveAnalysis] =
    useState<ReaderHighlightAnalysis | null>(null);
  const [streamError, setStreamError] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [deletingHighlightId, setDeletingHighlightId] = useState<
    number | null
  >(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(
    null,
  );
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<
    number[]
  >([]);
  const [importStatusByHighlightId, setImportStatusByHighlightId] =
    useState<Record<number, HighlightImportResultStatus>>({});
  const [isImportingSelected, setIsImportingSelected] = useState(false);
  const [isImportingActiveHighlight, setIsImportingActiveHighlight] =
    useState(false);
  const [activeView, setActiveView] =
    useState<HighlightToolsView>("helper");
  const explainAbortRef = useRef<AbortController | null>(null);

  const highlightsQuery = trpc.listReaderArticleHighlightsRoute.useQuery(
    { publicId },
    { retry: false },
  );
  const deleteHighlightMutation =
    trpc.deleteReaderArticleHighlightRoute.useMutation({
      retry: false,
    });
  const importHighlightsMutation =
    trpc.importReaderHighlightsToDeckRoute.useMutation({
      retry: false,
    });

  useEffect(() => {
    const updateSelection = () => {
      const articleElement = articleRef.current;
      if (!articleElement) {
        setSelectionDraft(null);
        setActiveHighlightId(null);
        setActiveAnalysis(null);
        return;
      }

      const next = buildSelectionDraft(articleElement);
      if (next) {
        setSelectionDraft(next);
        setHelperDraftOverride(null);
        setActiveHighlightId(null);
        return;
      }

      setSelectionDraft(null);
    };

    document.addEventListener("selectionchange", updateSelection);

    return () => {
      document.removeEventListener("selectionchange", updateSelection);
    };
  }, [articleRef]);

  useEffect(() => {
    return () => {
      explainAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (selectionDraft === null && !isExplaining) {
      return;
    }

    setActiveView("helper");
  }, [selectionDraft, isExplaining]);

  useEffect(() => {
    const clearDraft = () => {
      setSelectionDraft(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearDraft();
      }
    };

    window.addEventListener("resize", clearDraft);
    window.addEventListener("scroll", clearDraft, true);
    document.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("resize", clearDraft);
      window.removeEventListener("scroll", clearDraft, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const activeHelperDraft = helperDraftOverride ?? selectionDraft;

  const deleteHighlight = async (
    highlightId: number,
    options?: { clearHelperStateOnSuccess?: boolean },
  ) => {
    if (deletingHighlightId !== null) {
      return;
    }

    const clearHelperStateOnSuccess =
      options?.clearHelperStateOnSuccess ?? false;

    setDeletingHighlightId(highlightId);

    if (
      isExplaining &&
      (activeHighlightId === highlightId || clearHelperStateOnSuccess)
    ) {
      explainAbortRef.current?.abort();
      setIsExplaining(false);
    }

    try {
      await deleteHighlightMutation.mutateAsync({
        publicId,
        highlightId,
      });
      setSelectedHighlightIds((previous) => {
        return previous.filter((id) => id !== highlightId);
      });
      setImportStatusByHighlightId((previous) => {
        const next = { ...previous };
        delete next[highlightId];
        return next;
      });
      await highlightsQuery.refetch();

      const shouldClearHelperState =
        clearHelperStateOnSuccess || activeHighlightId === highlightId;
      if (!shouldClearHelperState) {
        return;
      }

      setActiveHighlightId(null);
      setHelperDraftOverride(null);
      setActiveAnalysis(null);
      setStreamError("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete highlight.";
      setStreamError(message);
    } finally {
      setDeletingHighlightId(null);
    }
  };

  const explainSelection = async () => {
    if (!activeHelperDraft || isExplaining) {
      return;
    }

    const controller = new AbortController();
    explainAbortRef.current?.abort();
    explainAbortRef.current = controller;

    setActiveAnalysis(null);
    setStreamError("");
    setIsExplaining(true);

    try {
      const response = await fetch(
        "/api/reader/highlight-explain-stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId,
            selectedText: activeHelperDraft.selectedText,
            contextBefore: activeHelperDraft.contextBefore,
            contextAfter: activeHelperDraft.contextAfter,
            occurrenceHint: activeHelperDraft.occurrenceHint,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(
          errorText || "Unable to start explanation stream.",
        );
      }

      const reader = response.body.getReader();
      await readSseStream(reader, {
        onAnalysis: (analysis) => {
          setActiveAnalysis(analysis);
        },
        onDone: () => {
          setIsExplaining(false);
        },
        onError: (message) => {
          setStreamError(message);
        },
      });

      const refreshedHighlights = await highlightsQuery.refetch();
      if (activeHighlightId !== null) {
        return;
      }

      const nextHighlights = refreshedHighlights.data?.highlights ?? [];
      const matchedHighlightId = findMatchingHighlightId(
        nextHighlights,
        activeHelperDraft,
      );
      if (matchedHighlightId === null) {
        return;
      }

      const matchedHighlight = nextHighlights.find((highlight) => {
        return highlight.id === matchedHighlightId;
      });
      setActiveHighlightId(matchedHighlightId);
      if (matchedHighlight) {
        setActiveAnalysis(analysisFromHighlight(matchedHighlight));
      }
    } catch (error) {
      const aborted = controller.signal.aborted;
      if (!aborted) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to stream explanation.";
        setStreamError(message);
      }
      setIsExplaining(false);
    }
  };

  const highlights = useMemo<ReaderArticleHighlight[]>(() => {
    return highlightsQuery.data?.highlights ?? [];
  }, [highlightsQuery.data]);
  const importableHighlightIds = useMemo(() => {
    return highlights
      .filter((highlight) => {
        return (
          highlight.status === "ready" && highlight.importedCardId === null
        );
      })
      .map((highlight) => highlight.id);
  }, [highlights]);
  const deckOptions = useMemo(() => {
    return decks.map((deck) => ({
      value: String(deck.id),
      label: deck.name,
    }));
  }, [decks]);

  useEffect(() => {
    const selectableIds = new Set(importableHighlightIds);

    setSelectedHighlightIds((previous) => {
      return previous.filter((highlightId) => {
        return selectableIds.has(highlightId);
      });
    });
  }, [importableHighlightIds]);

  useEffect(() => {
    if (selectedDeckId !== null) {
      return;
    }

    if (deckOptions.length === 0) {
      return;
    }

    setSelectedDeckId(deckOptions[0].value);
  }, [deckOptions, selectedDeckId]);

  const importHighlightIds = async (highlightIds: number[]) => {
    const result = await importHighlightsForDeck({
      mutateAsync: importHighlightsMutation.mutateAsync,
      publicId,
      selectedDeckId,
      highlightIds,
    });
    if (!result) {
      return null;
    }

    setImportStatusByHighlightId((previous) => {
      return mergeImportStatuses(previous, result.results);
    });
    await highlightsQuery.refetch();
    return result;
  };

  const importSelectedHighlights = async () => {
    setIsImportingSelected(true);
    try {
      const highlightIds =
        selectedHighlightIds.length > 0
          ? selectedHighlightIds
          : importableHighlightIds;
      const result = await importHighlightIds(highlightIds);
      if (!result) {
        return;
      }

      notifications.show({
        title: "Import complete",
        message: importSummaryMessage(result.summary),
        color: result.summary.created > 0 ? "green" : "gray",
      });
      setSelectedHighlightIds([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Import failed.";
      notifications.show({
        title: "Import failed",
        message,
        color: "red",
      });
    } finally {
      setIsImportingSelected(false);
    }
  };

  const matchedHighlightFromDraft = useMemo(() => {
    if (!activeHelperDraft) {
      return null;
    }

    const matchedHighlightId = findMatchingHighlightId(
      highlights,
      activeHelperDraft,
    );
    if (matchedHighlightId === null) {
      return null;
    }

    return (
      highlights.find(
        (highlight) => highlight.id === matchedHighlightId,
      ) ?? null
    );
  }, [activeHelperDraft, highlights]);

  const activeHighlight = useMemo(() => {
    if (activeHighlightId !== null) {
      const selectedHighlight = highlights.find((highlight) => {
        return highlight.id === activeHighlightId;
      });

      if (selectedHighlight) {
        return selectedHighlight;
      }
    }

    return matchedHighlightFromDraft;
  }, [activeHighlightId, highlights, matchedHighlightFromDraft]);

  const addActiveHighlightToDeck = async () => {
    setIsImportingActiveHighlight(true);
    try {
      const result = await importHighlightIds(
        activeHighlight ? [activeHighlight.id] : [],
      );
      if (!result) {
        return;
      }

      const status = result.results[0]?.status;
      if (!status) {
        return;
      }

      notifications.show({
        title: "Import",
        message: importStatusLabel(status),
        color: importStatusColor(status),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Import failed.";
      notifications.show({
        title: "Import failed",
        message,
        color: "red",
      });
    } finally {
      setIsImportingActiveHighlight(false);
    }
  };

  const canAddActiveHighlight = canAddHighlightToDeck(
    activeHighlight,
    selectedDeckId,
  );
  const canImportSelected = canImportSelectedHighlights({
    selectedDeckId,
    importableHighlightCount: importableHighlightIds.length,
    isImportingSelected,
    isMutationLoading: importHighlightsMutation.isLoading,
  });
  const allImportableSelected = areAllImportableHighlightsSelected({
    selectedHighlightIds,
    importableHighlightIds,
  });
  const canSelectAll = canSelectAllHighlights({
    importableHighlightIds,
    isImportingSelected,
  });
  const onAddToDeck = addToDeckHandlerOrUndefined(
    activeHighlight,
    addActiveHighlightToDeck,
  );
  const toggleSelectAllHighlights = () => {
    setSelectedHighlightIds((previous) => {
      return toggleAllSelectedHighlights(previous, importableHighlightIds);
    });
  };

  const savedHighlightsForRender = useMemo<
    SavedArticleHighlightForRender[]
  >(() => {
    return highlights.map((highlight) => ({
      id: highlight.id,
      selectedText: highlight.selectedText,
      selectedOccurrenceIndex: highlight.selectedOccurrenceIndex,
      contextBefore: highlight.contextBefore,
      contextAfter: highlight.contextAfter,
    }));
  }, [highlights]);

  useEffect(() => {
    const articleElement = articleRef.current;
    if (!articleElement) {
      return;
    }

    clearRenderedArticleHighlights(articleElement);

    if (savedHighlightsForRender.length === 0) {
      return;
    }

    const articleText = articleElement.textContent ?? "";
    const ranges = buildSavedArticleHighlightRanges({
      articleText,
      highlights: savedHighlightsForRender,
    });
    if (ranges.length === 0) {
      return;
    }

    applyRenderedArticleHighlights(articleElement, ranges);
  }, [articleRef, savedHighlightsForRender]);

  useEffect(() => {
    const articleElement = articleRef.current;
    if (!articleElement) {
      return;
    }

    const onHighlightClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const highlightMark = target.closest(
        "mark[data-reader-highlight='saved'][data-highlight-id]",
      );
      if (!(highlightMark instanceof HTMLElement)) {
        return;
      }

      const rawId = highlightMark.dataset.highlightId;
      if (!rawId) {
        return;
      }

      const highlightId = Number.parseInt(rawId, 10);
      if (!Number.isFinite(highlightId)) {
        return;
      }

      const clickedHighlight = highlights.find(
        (highlight) => highlight.id === highlightId,
      );
      if (!clickedHighlight) {
        return;
      }

      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      explainAbortRef.current?.abort();
      setIsExplaining(false);
      setSelectionDraft(null);
      setHelperDraftOverride(helperDraftFromHighlight(clickedHighlight));
      setActiveHighlightId(clickedHighlight.id);
      setActiveView("helper");

      setActiveAnalysis(analysisFromHighlight(clickedHighlight));

      if (
        clickedHighlight.status === "error" &&
        clickedHighlight.errorMessage.trim().length > 0
      ) {
        setStreamError(clickedHighlight.errorMessage);
      } else {
        setStreamError("");
      }
    };

    articleElement.addEventListener("click", onHighlightClick);
    return () => {
      articleElement.removeEventListener("click", onHighlightClick);
    };
  }, [articleRef, highlights]);

  const viewOptions = useMemo(() => {
    return [
      { label: "Word Help", value: "helper" },
      { label: `Saved (${highlights.length})`, value: "saved" },
      { label: "extras", value: "extras" },
    ];
  }, [highlights.length]);

  const queryErrorMessage = highlightsQuery.error?.message ?? "";
  const fillToolsBody = shouldFillToolsBody(activeView);
  const activeHighlightIdForActions = activeHighlight?.id ?? null;
  const canDeleteActiveHighlight = activeHighlightIdForActions !== null;
  const isDeletingActiveHighlight =
    activeHighlightIdForActions !== null &&
    deletingHighlightId === activeHighlightIdForActions;

  const deleteActiveHighlight = () => {
    if (activeHighlightIdForActions === null) {
      return;
    }

    void deleteHighlight(activeHighlightIdForActions, {
      clearHelperStateOnSuccess: true,
    });
  };

  return (
    <>
      <SelectionActionBubble
        isVisible={selectionDraft !== null}
        top={selectionDraft?.actionTop ?? 0}
        left={selectionDraft?.actionLeft ?? 0}
        isExplaining={isExplaining}
        onExplain={explainSelection}
      />
      <Box style={readerToolsRailStyle}>
        <ReaderPanel gap={6} style={readerToolsPanelStyle}>
          <Box style={readerToolsSwitchStyle}>
            {deckOptions.length > 0 && (
              <Select
                label="Deck"
                placeholder="Select deck"
                data={deckOptions}
                value={selectedDeckId}
                onChange={setSelectedDeckId}
                size="xs"
                mb={8}
              />
            )}
            {deckOptions.length === 0 && (
              <Text
                size="xs"
                c="dimmed"
                style={{ fontFamily: readerBodyFont, marginBottom: 8 }}
              >
                Create a deck to save highlights.
              </Text>
            )}
            <SegmentedControl
              value={activeView}
              onChange={(nextValue) => {
                setActiveView(parseHighlightToolsView(nextValue));
              }}
              data={viewOptions}
              fullWidth
              size="xs"
              radius="md"
              color="grape"
            />
          </Box>
          <Box
            style={
              fillToolsBody
                ? {
                    ...readerToolsContentStyle,
                    ...readerToolsBodyFillStyle,
                  }
                : readerToolsScrollableContentStyle
            }
          >
            {activeView === "helper" && (
              <ExplainSelectionCard
                isExplaining={isExplaining}
                streamError={streamError}
                analysis={activeAnalysis}
                onAddToDeck={onAddToDeck}
                canAddToDeck={canAddActiveHighlight}
                isAddingToDeck={isImportingActiveHighlight}
                onDeleteHighlight={deleteActiveHighlight}
                canDeleteHighlight={canDeleteActiveHighlight}
                isDeletingHighlight={isDeletingActiveHighlight}
                fillAvailableHeight
              />
            )}
            {activeView === "saved" && (
              <HighlightsHistoryCard
                highlights={highlights}
                isLoading={highlightsQuery.isLoading}
                errorMessage={queryErrorMessage}
                deletingHighlightId={deletingHighlightId}
                selectedHighlightIds={selectedHighlightIds}
                onToggleHighlightSelection={(highlightId, isSelected) => {
                  setSelectedHighlightIds((previous) => {
                    return toggleSelectedHighlights(
                      previous,
                      highlightId,
                      isSelected,
                    );
                  });
                }}
                onImportSelected={() => {
                  void importSelectedHighlights();
                }}
                canImportSelected={canImportSelected}
                isImportingSelected={isImportingSelected}
                onToggleSelectAll={toggleSelectAllHighlights}
                canSelectAll={canSelectAll}
                allImportableSelected={allImportableSelected}
                importStatusByHighlightId={importStatusByHighlightId}
                onDeleteHighlight={(highlightId) => {
                  void deleteHighlight(highlightId);
                }}
              />
            )}
            {activeView === "extras" && (
              <HighlightInfoCard
                publicId={publicId}
                createdAt={createdAt}
                sourceUrl={sourceUrl}
                codeLineMode={codeLineMode}
                onCodeLineModeChange={onCodeLineModeChange}
              />
            )}
          </Box>
        </ReaderPanel>
      </Box>
    </>
  );
}

function renderReadyArticleBody(
  inputKind: ReaderInputKind,
  markdownText: string,
  rawText: string,
  articleTitle: string,
  wrapCodeBlocks: boolean,
  articleRef?: React.RefObject<HTMLElement>,
): React.ReactNode {
  if (inputKind === "url") {
    const contentText = stripLeadingTitleFromMarkdown(
      markdownText,
      articleTitle,
    );
    return (
      <ReaderArticleBody
        contentText={contentText}
        emptyMessage="Article text is unavailable."
        wrapCodeBlocks={wrapCodeBlocks}
        articleRef={articleRef}
      />
    );
  }

  return (
    <ReaderArticleBody
      contentText={rawText}
      emptyMessage="Text is unavailable."
      skipHtml
      wrapCodeBlocks={wrapCodeBlocks}
      articleRef={articleRef}
    />
  );
}

function parseReaderCodeLineMode(value: string): ReaderCodeLineMode {
  if (value === "wrap") {
    return "wrap";
  }

  return "scroll";
}

export default function PublicReaderArticlePage({
  article,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const markdownText = normalizeMarkdownText(article.contentText);
  const rawText = article.contentText;
  const [codeLineMode, setCodeLineMode] =
    useState<ReaderCodeLineMode>("scroll");
  const shouldAutoRefresh =
    article.ingestStatus === "pending" ||
    article.ingestStatus === "in_progress";
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!shouldAutoRefresh) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.location.reload();
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldAutoRefresh]);

  const showProcessingState = article.ingestStatus !== "ready";
  const wrapCodeBlocks = codeLineMode === "wrap";
  const showCodeLineModeControl =
    !showProcessingState &&
    contentLikelyHasCodeBlocks(article.contentText);
  const articleBody = renderReadyArticleBody(
    article.inputKind,
    markdownText,
    rawText,
    article.title,
    wrapCodeBlocks,
    article.viewerIsOwner ? articleRef : undefined,
  );
  const ownerTools = article.viewerIsOwner ? (
    <OwnerHighlightTools
      publicId={article.publicId}
      articleRef={articleRef}
      createdAt={article.createdAt}
      sourceUrl={article.normalizedUrl}
      decks={article.decks}
      codeLineMode={codeLineMode}
      onCodeLineModeChange={(nextMode) => {
        setCodeLineMode(nextMode);
      }}
    />
  ) : null;

  return (
    <>
      <Head>
        <title>{`${article.title} · Koala Cards`}</title>
      </Head>
      <Box style={readerWorkspaceStyle}>
        <style jsx global>{`
          article mark[data-reader-highlight="saved"] {
            background: rgba(248, 205, 225, 0.62);
            border-radius: 0.26em;
            box-shadow: inset 0 -1px 0 rgba(177, 96, 134, 0.2);
            color: inherit;
            padding: 0 0.08em;
            cursor: pointer;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            transition:
              background 120ms ease,
              box-shadow 120ms ease;
          }
          article mark[data-reader-highlight="saved"]:hover {
            background: rgba(243, 176, 206, 0.7);
            box-shadow: inset 0 -1px 0 rgba(164, 81, 120, 0.35);
          }
          article[data-reader-article="content"] pre {
            margin: 1.05rem 0;
            padding: 0.92rem 1rem;
            border-radius: 14px;
            border: 1px solid ${readerPanelBorderColor};
            background: ${readerSubtleBackgroundColor};
            box-shadow: ${readerFrameShadow};
            max-width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            overscroll-behavior-x: contain;
          }
          article[data-reader-article="content"] pre code {
            display: block;
            width: max-content;
            min-width: 100%;
            font-size: 0.88rem;
            line-height: 1.58;
            font-family:
              "JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas,
              "Liberation Mono", monospace;
          }
          article[data-reader-article="content"][data-code-wrap="on"] pre {
            overflow-x: hidden;
          }
          article[data-reader-article="content"][data-code-wrap="on"]
            pre
            code {
            width: 100%;
            min-width: 0;
            white-space: pre-wrap;
            word-break: break-word;
          }
          article[data-reader-article="content"] :not(pre) > code {
            border-radius: 7px;
            border: 1px solid ${readerDividerColor};
            background: rgba(253, 244, 250, 0.95);
            padding: 0.1em 0.36em;
            font-size: 0.88em;
            font-family:
              "JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas,
              "Liberation Mono", monospace;
          }
        `}</style>
        <Stack gap="clamp(10px, 1.6vw, 18px)">
          {!article.viewerIsOwner && <ArticleMetaRow article={article} />}
          {showCodeLineModeControl && !article.viewerIsOwner && (
            <Group justify="space-between" align="center" wrap="wrap">
              <Text
                size="xs"
                c="dimmed"
                style={{ fontFamily: readerBodyFont }}
              >
                Code lines
              </Text>
              <SegmentedControl
                aria-label="Code line display mode"
                value={codeLineMode}
                onChange={(nextMode) => {
                  setCodeLineMode(parseReaderCodeLineMode(nextMode));
                }}
                data={[
                  { label: "Scroll long lines", value: "scroll" },
                  { label: "Wrap long lines", value: "wrap" },
                ]}
                size="xs"
                radius="xl"
                color="grape"
              />
            </Group>
          )}
          {showProcessingState && (
            <ProcessingCard
              status={article.ingestStatus}
              ingestError={article.ingestError}
            />
          )}
          {!showProcessingState && (
            <ReaderSplitWorkspace
              primary={articleBody}
              secondary={ownerTools}
              stickySecondary={article.viewerIsOwner}
              secondaryTopOffset={readerToolsTopOffset}
            />
          )}
        </Stack>
      </Box>
    </>
  );
}

function mapIngestStatus(
  status: "PENDING" | "IN_PROGRESS" | "READY" | "ERROR",
): PublicReaderArticle["ingestStatus"] {
  if (status === "PENDING") {
    return "pending";
  }

  if (status === "IN_PROGRESS") {
    return "in_progress";
  }

  if (status === "READY") {
    return "ready";
  }

  return "error";
}

function mapInputKind(value: "URL" | "RAW"): ReaderInputKind {
  if (value === "RAW") {
    return "raw";
  }

  return "url";
}

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const publicId = context.params?.publicId;
  if (typeof publicId !== "string" || publicId.trim().length === 0) {
    return { notFound: true };
  }

  const [article, session] = await Promise.all([
    prismaClient.readerArticle.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        title: true,
        normalizedUrl: true,
        inputKind: true,
        contentText: true,
        ingestStatus: true,
        ingestError: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
    getSession({ req: context.req }),
  ]);

  if (!article) {
    return { notFound: true };
  }

  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;
  const ownerEmail = article.user.email?.toLowerCase() ?? null;
  const viewerIsOwner =
    Boolean(viewerEmail) &&
    Boolean(ownerEmail) &&
    viewerEmail === ownerEmail;
  const decks = viewerIsOwner
    ? await prismaClient.deck.findMany({
        where: { userId: article.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  const payload: PublicReaderArticle = {
    publicId: article.publicId,
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    inputKind: mapInputKind(article.inputKind),
    contentText: article.contentText,
    ingestStatus: mapIngestStatus(article.ingestStatus),
    ingestError: article.ingestError,
    createdAt: article.createdAt.toISOString(),
    viewerIsOwner,
    decks,
  };

  return {
    props: {
      article: payload,
    },
  };
}
