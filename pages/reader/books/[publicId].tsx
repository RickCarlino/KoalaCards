import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import {
  applyRenderedArticleHighlights,
  clearRenderedArticleHighlights,
} from "@/koala/reader/article-highlight-dom";
import { buildSavedArticleHighlightRanges } from "@/koala/reader/article-highlight-ranges";
import {
  ensureLocalBookPermission,
  getLocalBookHandleByFingerprint,
  getLocalBookHandleByPublicId,
  isFileSystemAccessSupported,
  openEpubFileWithPicker,
  queryLocalBookPermission,
  requestPersistentReaderStorage,
  saveLocalBookHandle,
  saveLocalCoverCache,
  saveLocalManifestCache,
  type LocalBookHandleRecord,
} from "@/koala/reader/epub/local-library";
import {
  openEpubSession,
  readEpubManifest,
  type EpubSession,
} from "@/koala/reader/epub/parser";
import {
  DEFAULT_EPUB_READING_PREFERENCES,
  EPUB_READING_PREFERENCE_LIMITS,
  resolveEpubReadingPreferences,
} from "@/koala/reader/epub/preferences";
import {
  canRelinkReaderBook,
  manifestForRelinkedReaderBook,
} from "@/koala/reader/epub/relink";
import type {
  EpubBookLocator,
  EpubNavigationItem,
  EpubReadingPreferences,
  EpubSpineItem,
} from "@/koala/reader/epub/types";
import {
  canExplainSelection,
  hasExplainSelectionStream,
  resolveExplainSelectionErrorMessage,
} from "@/koala/reader/owner-highlight-tools";
import {
  ExplainSelectionCard,
  HighlightsHistoryCard,
  type HighlightImportResultStatus,
  type ReaderArticleHighlight,
  type ReaderHighlightAnalysis,
} from "@/koala/reader/ui/highlights";
import { ReaderPanel } from "@/koala/reader/ui/layout";
import {
  readerDividerColor,
  readerHeadingColor,
  readerPanelBorderColor,
} from "@/koala/reader/ui/theme";
import { trpc } from "@/koala/trpc-config";
import {
  Anchor,
  Box,
  Button,
  Group,
  Loader,
  ScrollArea,
  SegmentedControl,
  Select,
  Slider,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ReaderSelectionDraft = {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  occurrenceHint: number;
};

type BookLoadState =
  | "checking"
  | "missing"
  | "permission"
  | "loading"
  | "ready"
  | "error";

type RenderedSectionState = {
  html: string;
  text: string;
  objectUrls: string[];
};

type StreamHandlers = {
  onAnnotationId: (annotationId: number) => void;
  onAnalysis: (analysis: ReaderHighlightAnalysis) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

type ReaderBookHeaderData = {
  title: string;
  author: string;
};

type ReaderDeckOption = {
  id: number;
  name: string;
};

type ReaderBookPageProps = {
  initialPreferences: EpubReadingPreferences;
};

type SideRailPanel = "current" | "highlights" | "settings";

const SELECTION_CONTEXT_RADIUS = 60;
const AUTO_EXPLAIN_SELECTION_MAX_LENGTH = 80;
const readerPageStyle: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100vw",
  height: "100svh",
  maxHeight: "100svh",
  overflow: "hidden",
};
const bookWorkspaceStyle: React.CSSProperties = {
  boxSizing: "border-box",
  display: "grid",
  gridTemplateColumns:
    "minmax(275px, 335px) minmax(0, 1fr) minmax(400px, 460px)",
  alignItems: "stretch",
  minWidth: 0,
  width: "100%",
  height: "100%",
  minHeight: 0,
};
const bookWorkspaceResponsiveStyle: React.CSSProperties = {
  ...bookWorkspaceStyle,
  gridTemplateColumns:
    "minmax(275px, 335px) minmax(0, 1fr) minmax(400px, 460px)",
};
const readerBookRailStyle: React.CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  borderRight: `1px solid ${readerPanelBorderColor}`,
  backgroundColor: "#fffdfd",
  padding: "14px 16px",
  overflow: "hidden",
};
const readerBookRailBodyStyle: React.CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
};
const readerCenterStyle: React.CSSProperties = {
  boxSizing: "border-box",
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  backgroundColor: "#fff",
};
const bookFrameStyle: React.CSSProperties = {
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  backgroundColor: "#fff",
};
const iframeStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  border: 0,
  display: "block",
};
const sideRailStyle: React.CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  height: "100%",
  maxHeight: "100%",
  borderLeft: `1px solid ${readerPanelBorderColor}`,
  backgroundColor: "#fffdfd",
  padding: "12px 14px",
  overflow: "hidden",
};
const sideRailContentStyle: React.CSSProperties = {
  minWidth: 0,
  paddingRight: 6,
  paddingBottom: 16,
};
const sideRailScrollAreaStyle: React.CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  maxWidth: "100%",
};
const sideRailSectionStyle: React.CSSProperties = {
  minWidth: 0,
};
const selectedHighlightPreviewStyle: React.CSSProperties = {
  borderBottom: `1px solid ${readerDividerColor}`,
  paddingBottom: 8,
  overflowWrap: "anywhere",
};
const openingBookStates = new Set<BookLoadState>(["checking", "loading"]);
const sideRailPanelValues = new Set<SideRailPanel>([
  "current",
  "highlights",
  "settings",
]);
const sideRailPanelOptions = [
  { value: "current", label: "Current" },
  { value: "highlights", label: "Highlights" },
  { value: "settings", label: "Settings" },
];

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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

function normalizeHref(value: string): string {
  return value.split("#")[0].split("?")[0];
}

function isSideRailPanel(value: string): value is SideRailPanel {
  return sideRailPanelValues.has(value as SideRailPanel);
}

function shouldIgnoreReaderKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const interactiveElement = target.closest(
    [
      "a",
      "button",
      "input",
      "select",
      "textarea",
      "[contenteditable='true']",
      "[role='button']",
      "[role='tab']",
    ].join(","),
  );

  return target.isContentEditable || interactiveElement !== null;
}

function readerKeyboardDirection(event: KeyboardEvent): -1 | 0 | 1 {
  if (event.defaultPrevented || event.altKey || event.ctrlKey) {
    return 0;
  }

  if (event.metaKey || event.shiftKey) {
    return 0;
  }

  if (shouldIgnoreReaderKeyTarget(event.target)) {
    return 0;
  }

  if (event.key === "ArrowLeft") {
    return -1;
  }

  if (event.key === "ArrowRight") {
    return 1;
  }

  return 0;
}

function findSectionIndex(
  spineJson: EpubSpineItem[],
  href: string | undefined,
): number {
  if (!href) {
    return 0;
  }

  const normalized = normalizeHref(href);
  const index = spineJson.findIndex((spineItem) => {
    return normalizeHref(spineItem.href) === normalized;
  });

  if (index < 0) {
    return 0;
  }

  return index;
}

function currentProgressionFromFrame(
  iframe: HTMLIFrameElement | null,
): number {
  const document = iframe?.contentDocument;
  const scrollingElement = document?.scrollingElement;
  if (!scrollingElement) {
    return 0;
  }

  const maxScroll = Math.max(
    1,
    scrollingElement.scrollHeight - scrollingElement.clientHeight,
  );
  return scrollingElement.scrollTop / maxScroll;
}

function scrollFrameToProgression(
  iframe: HTMLIFrameElement | null,
  locator: EpubBookLocator | null,
): void {
  if (!locator || typeof locator.progression !== "number") {
    return;
  }

  const document = iframe?.contentDocument;
  const scrollingElement = document?.scrollingElement;
  if (!scrollingElement) {
    return;
  }

  const progression = Math.max(0, Math.min(1, locator.progression));
  const maxScroll = Math.max(
    0,
    scrollingElement.scrollHeight - scrollingElement.clientHeight,
  );
  scrollingElement.scrollTop = maxScroll * progression;
}

function isAnnotationInSection(
  annotation: ReaderArticleHighlight & { locatorJson?: EpubBookLocator },
  sectionHref: string,
): boolean {
  return (
    normalizeHref(annotation.locatorJson?.href ?? "") ===
    normalizeHref(sectionHref)
  );
}

function readerPublicIdFromQuery(
  publicId: string | string[] | undefined,
): string {
  if (typeof publicId === "string") {
    return publicId;
  }

  return "";
}

function isImportableAnnotation(
  annotation: ReaderArticleHighlight,
): boolean {
  return (
    annotation.status === "ready" && annotation.importedCardId === null
  );
}

function importableAnnotationIdsFrom(
  annotations: ReaderArticleHighlight[],
): number[] {
  return annotations.filter(isImportableAnnotation).map((annotation) => {
    return annotation.id;
  });
}

function areAllImportableAnnotationsSelected(options: {
  importableAnnotationIds: number[];
  selectedAnnotationIds: number[];
}): boolean {
  if (options.importableAnnotationIds.length === 0) {
    return false;
  }

  return options.importableAnnotationIds.every((id) =>
    options.selectedAnnotationIds.includes(id),
  );
}

function canImportReaderAnnotations(options: {
  selectedAnnotationIds: number[];
  selectedDeckId: string | null;
}): boolean {
  return (
    options.selectedAnnotationIds.length > 0 &&
    options.selectedDeckId !== null
  );
}

function selectionDraftKey(options: {
  draft: ReaderSelectionDraft;
  sectionHref: string;
}): string {
  const { draft, sectionHref } = options;

  return JSON.stringify([
    sectionHref,
    draft.selectedText,
    draft.contextBefore,
    draft.contextAfter,
    draft.occurrenceHint,
  ]);
}

function isAutoExplainSelection(
  draft: ReaderSelectionDraft | null,
): boolean {
  return (
    draft !== null &&
    draft.selectedText.length <= AUTO_EXPLAIN_SELECTION_MAX_LENGTH
  );
}

function annotationAnalysis(
  annotation: ReaderArticleHighlight,
): ReaderHighlightAnalysis | null {
  const analysis = {
    term: annotation.term,
    definition: annotation.definition,
    generalMeaning: annotation.generalMeaning,
    meaningInContext: annotation.meaningInContext,
  };

  if (
    annotation.status !== "ready" ||
    analysis.definition.trim().length === 0 ||
    analysis.generalMeaning.trim().length === 0 ||
    analysis.meaningInContext.trim().length === 0
  ) {
    return null;
  }

  return analysis;
}

function selectionDraftFromAnnotation(
  annotation: ReaderArticleHighlight,
): ReaderSelectionDraft {
  return {
    selectedText: annotation.selectedText,
    contextBefore: annotation.contextBefore,
    contextAfter: annotation.contextAfter,
    occurrenceHint: annotation.selectedOccurrenceIndex,
  };
}

function readerBookImportStatusLabel(
  status: HighlightImportResultStatus,
): string {
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

function readerBookImportStatusColor(
  status: HighlightImportResultStatus,
): string {
  if (status === "created") {
    return "green";
  }

  if (status === "not_ready") {
    return "yellow";
  }

  return "gray";
}

function importStatusIsAdded(
  status: HighlightImportResultStatus | undefined,
): boolean {
  return status === "created" || status === "already_imported";
}

function closestElementFromEventTarget(
  target: EventTarget | null,
  selector: string,
): Element | null {
  if (!target || typeof target !== "object") {
    return null;
  }

  const targetElement = target as {
    closest?: (selector: string) => Element | null;
    parentElement?: Element | null;
  };
  if (typeof targetElement.closest === "function") {
    return targetElement.closest(selector);
  }

  return targetElement.parentElement?.closest(selector) ?? null;
}

function activeAnnotationFrom(
  annotations: ReaderArticleHighlight[],
  explainedAnnotationId: number | null,
): ReaderArticleHighlight | null {
  if (explainedAnnotationId === null) {
    return null;
  }

  return (
    annotations.find(
      (annotation) => annotation.id === explainedAnnotationId,
    ) ?? null
  );
}

function activeImportStatusFrom(options: {
  explainedAnnotationId: number | null;
  importStatusByAnnotationId: Record<number, HighlightImportResultStatus>;
}): HighlightImportResultStatus | undefined {
  if (options.explainedAnnotationId === null) {
    return undefined;
  }

  return options.importStatusByAnnotationId[options.explainedAnnotationId];
}

function isActiveAnnotationAlreadyAdded(options: {
  activeAnnotation: ReaderArticleHighlight | null;
  activeImportStatus: HighlightImportResultStatus | undefined;
}): boolean {
  if (
    options.activeAnnotation !== null &&
    options.activeAnnotation.importedCardId !== null
  ) {
    return true;
  }

  return importStatusIsAdded(options.activeImportStatus);
}

function canAddActiveAnnotationToDeck(options: {
  explainedAnnotationId: number | null;
  selectedDeckId: string | null;
  analysis: ReaderHighlightAnalysis | null;
  activeAnnotationAlreadyAdded: boolean;
  isExplaining: boolean;
  isImportingActiveAnnotation: boolean;
}): boolean {
  if (options.explainedAnnotationId === null) {
    return false;
  }

  if (options.selectedDeckId === null) {
    return false;
  }

  if (options.analysis === null) {
    return false;
  }

  if (options.activeAnnotationAlreadyAdded || options.isExplaining) {
    return false;
  }

  return !options.isImportingActiveAnnotation;
}

function activeAnnotationHandlerOrUndefined(options: {
  explainedAnnotationId: number | null;
  activeAnnotationAlreadyAdded: boolean;
  handler: () => Promise<void>;
}): (() => void) | undefined {
  if (options.explainedAnnotationId === null) {
    return undefined;
  }

  if (options.activeAnnotationAlreadyAdded) {
    return undefined;
  }

  return () => {
    void options.handler();
  };
}

function textOffsetBeforeRange(
  container: HTMLElement,
  range: Range,
): number {
  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function buildSelectionDraftFromFrame(options: {
  iframe: HTMLIFrameElement;
  sectionText: string;
}): ReaderSelectionDraft | null {
  const frameWindow = options.iframe.contentWindow;
  const frameDocument = options.iframe.contentDocument;
  const selection = frameWindow?.getSelection();
  const body = frameDocument?.body;
  if (!selection || selection.rangeCount === 0 || !body) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const selectedText = range.toString().trim();
  if (!selectedText || selectedText.length > 220) {
    return null;
  }

  if (!body.contains(range.commonAncestorContainer)) {
    return null;
  }

  const startOffset = textOffsetBeforeRange(body, range);
  const contextBefore = options.sectionText.slice(
    Math.max(0, startOffset - SELECTION_CONTEXT_RADIUS),
    startOffset,
  );
  const contextAfter = options.sectionText.slice(
    startOffset + selectedText.length,
    startOffset + selectedText.length + SELECTION_CONTEXT_RADIUS,
  );

  return {
    selectedText,
    contextBefore,
    contextAfter,
    occurrenceHint: countOverlappingOccurrences(
      options.sectionText.slice(0, startOffset),
      selectedText,
    ),
  };
}

function parseSseEvent(rawEvent: string): {
  event: string;
  data: string;
} | null {
  const lines = rawEvent.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

async function readBookExplainStream(
  response: Response & { body: ReadableStream<Uint8Array> },
  handlers: StreamHandlers,
): Promise<void> {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let done = false;
  while (!done) {
    const next = await reader.read();
    done = next.done;
    if (done) {
      break;
    }

    buffer += decoder.decode(next.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const parsedEvent = parseSseEvent(rawEvent);
      if (!parsedEvent) {
        continue;
      }

      if (parsedEvent.event === "highlight") {
        const payload = JSON.parse(parsedEvent.data) as { id: number };
        handlers.onAnnotationId(payload.id);
      }
      if (parsedEvent.event === "analysis") {
        handlers.onAnalysis(
          JSON.parse(parsedEvent.data) as ReaderHighlightAnalysis,
        );
      }
      if (parsedEvent.event === "error") {
        handlers.onError(parsedEvent.data);
      }
      if (parsedEvent.event === "done") {
        handlers.onDone();
      }
    }
  }
}

function NavigationList({
  items,
  onJump,
}: {
  items: EpubNavigationItem[];
  onJump: (href: string) => void;
}) {
  return (
    <Stack gap={4}>
      {items.map((item) => (
        <Stack key={`${item.href}-${item.label}`} gap={4}>
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            justify="flex-start"
            onClick={() => onJump(item.href)}
            style={{
              minHeight: 24,
              whiteSpace: "normal",
              textAlign: "left",
            }}
            fullWidth
          >
            {item.label}
          </Button>
          {item.children.length > 0 && (
            <Box pl="sm">
              <NavigationList items={item.children} onJump={onJump} />
            </Box>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function BookLoadingPanel() {
  return (
    <Box style={readerPageStyle}>
      <Group gap="xs" align="center">
        <Loader size="sm" color="pink" />
        <Text c="dimmed">Loading book...</Text>
      </Group>
    </Box>
  );
}

function BookQueryErrorPanel({ errorMessage }: { errorMessage: string }) {
  return (
    <Box style={readerPageStyle}>
      <ReaderPanel>
        <Text c="red">{errorMessage}</Text>
        <Anchor component={Link} href="/reader" size="sm">
          Back to Reader
        </Anchor>
      </ReaderPanel>
    </Box>
  );
}

function BookInfoRail({
  book,
  currentSpineItem,
  sectionIndex,
  sectionCount,
  readerUnavailable,
  navigationItems,
  isRelinking,
  onSectionChange,
  onJumpToLocator,
  onRelink,
}: {
  book: ReaderBookHeaderData;
  currentSpineItem: EpubSpineItem | null;
  sectionIndex: number;
  sectionCount: number;
  readerUnavailable: boolean;
  navigationItems: EpubNavigationItem[];
  isRelinking: boolean;
  onSectionChange: (nextIndex: number) => void;
  onJumpToLocator: (locator: EpubBookLocator) => void;
  onRelink: () => void;
}) {
  const hasAuthor = book.author.trim().length > 0;
  const previousDisabled = readerUnavailable || sectionIndex <= 0;
  const nextDisabled =
    readerUnavailable || sectionIndex >= sectionCount - 1;
  const sectionTitle =
    currentSpineItem?.title ?? `Section ${sectionIndex + 1}`;

  return (
    <Box component="aside" style={readerBookRailStyle}>
      <Anchor component={Link} href="/reader" size="sm">
        Reader
      </Anchor>
      <Stack gap={4} style={{ minWidth: 0 }}>
        <Text
          size="lg"
          fw={700}
          c={readerHeadingColor}
          lineClamp={5}
          style={{ lineHeight: 1.25 }}
        >
          {book.title}
        </Text>
        {hasAuthor ? (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {book.author}
          </Text>
        ) : null}
      </Stack>
      <Stack
        gap="xs"
        style={{
          borderTop: `1px solid ${readerDividerColor}`,
          paddingTop: 14,
          minWidth: 0,
        }}
      >
        <Text size="xs" c="dimmed">
          Section {sectionIndex + 1} / {sectionCount}
        </Text>
        <Text size="sm" fw={700} c={readerHeadingColor} lineClamp={4}>
          {sectionTitle}
        </Text>
        <Group gap="xs" grow>
          <Button
            variant="light"
            color="gray"
            size="compact-sm"
            disabled={previousDisabled}
            onClick={() => onSectionChange(sectionIndex - 1)}
          >
            Previous
          </Button>
          <Button
            variant="light"
            color="gray"
            size="compact-sm"
            disabled={nextDisabled}
            onClick={() => onSectionChange(sectionIndex + 1)}
          >
            Next
          </Button>
        </Group>
      </Stack>
      <Box style={readerBookRailBodyStyle}>
        <Stack gap="xs" h="100%" style={{ minWidth: 0 }}>
          <Group justify="space-between" gap="sm" wrap="nowrap">
            <Text size="sm" fw={700} c={readerHeadingColor}>
              Contents
            </Text>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              onClick={onRelink}
              loading={isRelinking}
            >
              Relink
            </Button>
          </Group>
          <ScrollArea
            h="100%"
            type="auto"
            style={{ flex: "1 1 auto", minHeight: 0 }}
          >
            <Box pr={6}>
              <NavigationList
                items={navigationItems}
                onJump={(href) => {
                  onJumpToLocator({ href, progression: 0 });
                }}
              />
            </Box>
          </ScrollArea>
        </Stack>
      </Box>
    </Box>
  );
}

function OpeningBookPanel() {
  return (
    <Group h="100%" align="center" justify="center" gap="xs">
      <Loader size="sm" color="pink" />
      <Text c="dimmed">Opening book...</Text>
    </Group>
  );
}

function RelinkBookPanel({
  isRelinking,
  onRelink,
}: {
  isRelinking: boolean;
  onRelink: () => void;
}) {
  return (
    <Stack h="100%" align="center" justify="center" gap="xs">
      <Text c="dimmed">Local file needed.</Text>
      <Button
        color="pink"
        size="sm"
        onClick={onRelink}
        loading={isRelinking}
      >
        Relink EPUB
      </Button>
    </Stack>
  );
}

function PermissionBookPanel({
  onRequestPermission,
}: {
  onRequestPermission: () => void;
}) {
  return (
    <Stack h="100%" align="center" justify="center" gap="xs">
      <Text c="dimmed">Permission needed.</Text>
      <Button color="pink" size="sm" onClick={onRequestPermission}>
        Open local file
      </Button>
    </Stack>
  );
}

function BookFrameErrorPanel({
  loadError,
  isRelinking,
  onRelink,
}: {
  loadError: string;
  isRelinking: boolean;
  onRelink: () => void;
}) {
  return (
    <Stack h="100%" align="center" justify="center" gap="xs">
      <Text c="red">{loadError}</Text>
      <Button
        color="pink"
        size="sm"
        onClick={onRelink}
        loading={isRelinking}
      >
        Relink EPUB
      </Button>
    </Stack>
  );
}

function RenderedBookIframe({
  iframeRef,
  title,
  renderedSection,
  onLoad,
}: {
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  title: string;
  renderedSection: RenderedSectionState | null;
  onLoad: () => void;
}) {
  if (!renderedSection) {
    return null;
  }

  return (
    <iframe
      ref={iframeRef}
      title={title}
      sandbox="allow-same-origin"
      srcDoc={renderedSection.html}
      onLoad={onLoad}
      style={iframeStyle}
    />
  );
}

function BookFrameContent({
  loadState,
  loadError,
  title,
  renderedSection,
  iframeRef,
  isRelinking,
  onRelink,
  onRequestPermission,
  onIframeLoad,
}: {
  loadState: BookLoadState;
  loadError: string;
  title: string;
  renderedSection: RenderedSectionState | null;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  isRelinking: boolean;
  onRelink: () => void;
  onRequestPermission: () => void;
  onIframeLoad: () => void;
}) {
  if (loadState === "ready") {
    return (
      <RenderedBookIframe
        iframeRef={iframeRef}
        title={title}
        renderedSection={renderedSection}
        onLoad={onIframeLoad}
      />
    );
  }

  if (openingBookStates.has(loadState)) {
    return <OpeningBookPanel />;
  }

  if (loadState === "missing") {
    return (
      <RelinkBookPanel isRelinking={isRelinking} onRelink={onRelink} />
    );
  }

  if (loadState === "permission") {
    return (
      <PermissionBookPanel onRequestPermission={onRequestPermission} />
    );
  }

  if (loadState === "error") {
    return (
      <BookFrameErrorPanel
        loadError={loadError}
        isRelinking={isRelinking}
        onRelink={onRelink}
      />
    );
  }

  return null;
}

function BookReaderPanel({
  loadState,
  loadError,
  title,
  renderedSection,
  iframeRef,
  isRelinking,
  onRelink,
  onRequestPermission,
  onIframeLoad,
}: {
  loadState: BookLoadState;
  loadError: string;
  title: string;
  renderedSection: RenderedSectionState | null;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  isRelinking: boolean;
  onRelink: () => void;
  onRequestPermission: () => void;
  onIframeLoad: () => void;
}) {
  return (
    <Box style={readerCenterStyle}>
      <Box style={bookFrameStyle}>
        <BookFrameContent
          loadState={loadState}
          loadError={loadError}
          title={title}
          renderedSection={renderedSection}
          iframeRef={iframeRef}
          isRelinking={isRelinking}
          onRelink={onRelink}
          onRequestPermission={onRequestPermission}
          onIframeLoad={onIframeLoad}
        />
      </Box>
    </Box>
  );
}

function currentHighlightDeleteState(options: {
  explainedAnnotationId: number | null;
  deletingAnnotationId: number | null;
  onDeleteAnnotation: (annotationId: number) => void;
}): {
  deleteHighlight?: () => void;
  canDeleteHighlight: boolean;
  isDeletingHighlight: boolean;
} {
  if (options.explainedAnnotationId === null) {
    return {
      canDeleteHighlight: false,
      isDeletingHighlight: false,
    };
  }

  const annotationId = options.explainedAnnotationId;
  return {
    deleteHighlight: () => options.onDeleteAnnotation(annotationId),
    canDeleteHighlight: true,
    isDeletingHighlight: options.deletingAnnotationId === annotationId,
  };
}

function shouldShowCurrentHighlightText(options: {
  selectionDraft: ReaderSelectionDraft | null;
  analysis: ReaderHighlightAnalysis | null;
}): boolean {
  return options.selectionDraft !== null && options.analysis === null;
}

function shouldShowManualCurrentExplain(options: {
  selectionDraft: ReaderSelectionDraft | null;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
}): boolean {
  if (options.selectionDraft === null || options.analysis !== null) {
    return false;
  }

  if (!isAutoExplainSelection(options.selectionDraft)) {
    return true;
  }

  return options.streamError.trim().length > 0;
}

function CurrentHighlightPanel({
  selectionDraft,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
  canAddActiveAnnotation,
  isImportingActiveAnnotation,
  deletingAnnotationId,
  onExplainSelection,
  onAddActiveAnnotation,
  onDeleteAnnotation,
}: {
  selectionDraft: ReaderSelectionDraft | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
  deletingAnnotationId: number | null;
  canAddActiveAnnotation: boolean;
  isImportingActiveAnnotation: boolean;
  onExplainSelection: () => void;
  onAddActiveAnnotation?: () => void;
  onDeleteAnnotation: (annotationId: number) => void;
}) {
  const { deleteHighlight, canDeleteHighlight, isDeletingHighlight } =
    currentHighlightDeleteState({
      explainedAnnotationId,
      deletingAnnotationId,
      onDeleteAnnotation,
    });
  const showManualExplain = shouldShowManualCurrentExplain({
    selectionDraft,
    streamError,
    analysis,
  });
  const explainLabel = streamError.trim().length > 0 ? "Retry" : "Explain";
  const showSelectedText = shouldShowCurrentHighlightText({
    selectionDraft,
    analysis,
  });
  const selectedText = selectionDraft?.selectedText ?? "";

  return (
    <Stack gap="sm" style={sideRailSectionStyle}>
      {showSelectedText ? (
        <Stack gap={6}>
          <Text
            size="sm"
            fw={700}
            c={readerHeadingColor}
            style={selectedHighlightPreviewStyle}
          >
            {selectedText}
          </Text>
          {showManualExplain ? (
            <Button
              size="compact-sm"
              color="grape"
              onClick={onExplainSelection}
              loading={isExplaining}
              disabled={isExplaining}
            >
              {explainLabel}
            </Button>
          ) : null}
        </Stack>
      ) : null}
      {!selectionDraft ? (
        <Text size="sm" c="dimmed">
          Highlight text to explain it.
        </Text>
      ) : null}
      <ExplainSelectionCard
        isExplaining={isExplaining}
        streamError={streamError}
        analysis={analysis}
        onAddToDeck={onAddActiveAnnotation}
        canAddToDeck={canAddActiveAnnotation}
        isAddingToDeck={isImportingActiveAnnotation}
        onDeleteHighlight={deleteHighlight}
        canDeleteHighlight={canDeleteHighlight}
        isDeletingHighlight={isDeletingHighlight}
        flowExplanation
      />
    </Stack>
  );
}

function HighlightDeckActionRow({
  decks,
  selectedDeckId,
  canImportSelected,
  isImportingSelected,
  canSelectAll,
  allImportableSelected,
  onDeckChange,
  onImportSelected,
  onToggleSelectAll,
}: {
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  canImportSelected: boolean;
  isImportingSelected: boolean;
  canSelectAll: boolean;
  allImportableSelected: boolean;
  onDeckChange: (deckId: string | null) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
}) {
  const deckOptions = decks.map((deck) => ({
    value: String(deck.id),
    label: deck.name,
  }));

  return (
    <Group
      gap="xs"
      align="center"
      wrap="wrap"
      style={{ minWidth: 0, width: "100%" }}
    >
      <Select
        aria-label="Deck"
        placeholder="Deck"
        size="xs"
        value={selectedDeckId}
        onChange={onDeckChange}
        data={deckOptions}
        style={{ flex: "1 1 150px", minWidth: 0, maxWidth: "100%" }}
      />
      <Button
        size="compact-sm"
        color="grape"
        onClick={onImportSelected}
        disabled={!canImportSelected}
        loading={isImportingSelected}
        style={{ flex: "0 1 auto" }}
      >
        Add to deck
      </Button>
      <Button
        size="compact-sm"
        variant="subtle"
        color="grape"
        onClick={onToggleSelectAll}
        disabled={!canSelectAll}
        style={{ flex: "0 1 auto" }}
      >
        {allImportableSelected ? "Clear all" : "Select all"}
      </Button>
    </Group>
  );
}

function SettingsPanel({
  preferences,
  setPreferences,
}: {
  preferences: EpubReadingPreferences;
  setPreferences: React.Dispatch<
    React.SetStateAction<EpubReadingPreferences>
  >;
}) {
  return (
    <Stack gap="sm" style={sideRailSectionStyle}>
      <ReadingPreferencesControls
        preferences={preferences}
        setPreferences={setPreferences}
      />
    </Stack>
  );
}

function ReadingPreferencesControls({
  preferences,
  setPreferences,
}: {
  preferences: EpubReadingPreferences;
  setPreferences: React.Dispatch<
    React.SetStateAction<EpubReadingPreferences>
  >;
}) {
  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        Font size
      </Text>
      <Slider
        min={EPUB_READING_PREFERENCE_LIMITS.fontSize.min}
        max={EPUB_READING_PREFERENCE_LIMITS.fontSize.max}
        step={EPUB_READING_PREFERENCE_LIMITS.fontSize.step}
        value={preferences.fontSize}
        onChange={(fontSize) => {
          setPreferences((current) => ({
            ...current,
            fontSize,
          }));
        }}
        color="pink"
      />
      <Text size="xs" c="dimmed">
        Line height
      </Text>
      <Slider
        min={EPUB_READING_PREFERENCE_LIMITS.lineHeight.min}
        max={EPUB_READING_PREFERENCE_LIMITS.lineHeight.max}
        step={EPUB_READING_PREFERENCE_LIMITS.lineHeight.step}
        value={preferences.lineHeight}
        onChange={(lineHeight) => {
          setPreferences((current) => ({
            ...current,
            lineHeight,
          }));
        }}
        color="pink"
      />
      <Text size="xs" c="dimmed">
        Width
      </Text>
      <Slider
        min={EPUB_READING_PREFERENCE_LIMITS.columnWidth.min}
        max={EPUB_READING_PREFERENCE_LIMITS.columnWidth.max}
        step={EPUB_READING_PREFERENCE_LIMITS.columnWidth.step}
        value={preferences.columnWidth}
        onChange={(columnWidth) => {
          setPreferences((current) => ({
            ...current,
            columnWidth,
          }));
        }}
        color="pink"
      />
    </Stack>
  );
}

function HighlightsPanel({
  decks,
  selectedDeckId,
  annotations,
  isFetching,
  deletingAnnotationId,
  selectedAnnotationIds,
  canImportSelected,
  isImportingSelected,
  importableAnnotationIds,
  allImportableSelected,
  importStatusByAnnotationId,
  onDeckChange,
  onOpenAnnotation,
  onToggleAnnotationSelection,
  onImportSelected,
  onToggleSelectAll,
  onDeleteAnnotation,
}: {
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  annotations: ReaderArticleHighlight[];
  isFetching: boolean;
  deletingAnnotationId: number | null;
  selectedAnnotationIds: number[];
  canImportSelected: boolean;
  isImportingSelected: boolean;
  importableAnnotationIds: number[];
  allImportableSelected: boolean;
  importStatusByAnnotationId: Record<number, HighlightImportResultStatus>;
  onDeckChange: (deckId: string | null) => void;
  onOpenAnnotation?: (annotation: ReaderArticleHighlight) => void;
  onToggleAnnotationSelection: (
    annotationId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
  onDeleteAnnotation: (annotationId: number) => void;
}) {
  const showBulkActions = annotations.length > 0;

  return (
    <Stack gap="sm" style={sideRailSectionStyle}>
      {showBulkActions ? (
        <HighlightDeckActionRow
          decks={decks}
          selectedDeckId={selectedDeckId}
          canImportSelected={canImportSelected}
          isImportingSelected={isImportingSelected}
          canSelectAll={importableAnnotationIds.length > 0}
          allImportableSelected={allImportableSelected}
          onDeckChange={onDeckChange}
          onImportSelected={onImportSelected}
          onToggleSelectAll={onToggleSelectAll}
        />
      ) : null}
      <HighlightsHistoryCard
        highlights={annotations}
        isLoading={isFetching}
        errorMessage=""
        hideActions
        deletingHighlightId={deletingAnnotationId}
        selectedHighlightIds={selectedAnnotationIds}
        onToggleHighlightSelection={onToggleAnnotationSelection}
        onImportSelected={onImportSelected}
        canImportSelected={canImportSelected}
        isImportingSelected={isImportingSelected}
        onToggleSelectAll={onToggleSelectAll}
        canSelectAll={importableAnnotationIds.length > 0}
        allImportableSelected={allImportableSelected}
        importStatusByHighlightId={importStatusByAnnotationId}
        onDeleteHighlight={onDeleteAnnotation}
        onOpenHighlight={onOpenAnnotation}
      />
    </Stack>
  );
}

function BookSideRail({
  activePanel,
  selectionDraft,
  preferences,
  decks,
  selectedDeckId,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
  canAddActiveAnnotation,
  isImportingActiveAnnotation,
  annotations,
  isFetching,
  deletingAnnotationId,
  selectedAnnotationIds,
  canImportSelected,
  isImportingSelected,
  importableAnnotationIds,
  allImportableSelected,
  importStatusByAnnotationId,
  setPreferences,
  onActivePanelChange,
  onDeckChange,
  onExplainSelection,
  onAddActiveAnnotation,
  onOpenAnnotation,
  onToggleAnnotationSelection,
  onImportSelected,
  onToggleSelectAll,
  onDeleteAnnotation,
}: {
  activePanel: SideRailPanel;
  selectionDraft: ReaderSelectionDraft | null;
  preferences: EpubReadingPreferences;
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
  canAddActiveAnnotation: boolean;
  isImportingActiveAnnotation: boolean;
  annotations: ReaderArticleHighlight[];
  isFetching: boolean;
  deletingAnnotationId: number | null;
  selectedAnnotationIds: number[];
  canImportSelected: boolean;
  isImportingSelected: boolean;
  importableAnnotationIds: number[];
  allImportableSelected: boolean;
  importStatusByAnnotationId: Record<number, HighlightImportResultStatus>;
  setPreferences: React.Dispatch<
    React.SetStateAction<EpubReadingPreferences>
  >;
  onActivePanelChange: (panel: SideRailPanel) => void;
  onDeckChange: (deckId: string | null) => void;
  onExplainSelection: () => void;
  onAddActiveAnnotation?: () => void;
  onOpenAnnotation?: (annotation: ReaderArticleHighlight) => void;
  onToggleAnnotationSelection: (
    annotationId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
  onDeleteAnnotation: (annotationId: number) => void;
}) {
  let activePanelContent: React.ReactNode = null;

  if (activePanel === "current") {
    activePanelContent = (
      <CurrentHighlightPanel
        selectionDraft={selectionDraft}
        isExplaining={isExplaining}
        streamError={streamError}
        analysis={analysis}
        explainedAnnotationId={explainedAnnotationId}
        canAddActiveAnnotation={canAddActiveAnnotation}
        isImportingActiveAnnotation={isImportingActiveAnnotation}
        deletingAnnotationId={deletingAnnotationId}
        onExplainSelection={onExplainSelection}
        onAddActiveAnnotation={onAddActiveAnnotation}
        onDeleteAnnotation={onDeleteAnnotation}
      />
    );
  }

  if (activePanel === "highlights") {
    activePanelContent = (
      <HighlightsPanel
        decks={decks}
        selectedDeckId={selectedDeckId}
        annotations={annotations}
        isFetching={isFetching}
        deletingAnnotationId={deletingAnnotationId}
        selectedAnnotationIds={selectedAnnotationIds}
        canImportSelected={canImportSelected}
        isImportingSelected={isImportingSelected}
        importableAnnotationIds={importableAnnotationIds}
        allImportableSelected={allImportableSelected}
        importStatusByAnnotationId={importStatusByAnnotationId}
        onDeckChange={onDeckChange}
        onOpenAnnotation={onOpenAnnotation}
        onToggleAnnotationSelection={onToggleAnnotationSelection}
        onImportSelected={onImportSelected}
        onToggleSelectAll={onToggleSelectAll}
        onDeleteAnnotation={onDeleteAnnotation}
      />
    );
  }

  if (activePanel === "settings") {
    activePanelContent = (
      <SettingsPanel
        preferences={preferences}
        setPreferences={setPreferences}
      />
    );
  }

  return (
    <Stack gap="sm" style={sideRailStyle}>
      <SegmentedControl
        value={activePanel}
        onChange={(value) => {
          if (isSideRailPanel(value)) {
            onActivePanelChange(value);
          }
        }}
        data={sideRailPanelOptions}
        size="xs"
        color="pink"
        fullWidth
      />
      <ScrollArea h="100%" type="auto" style={sideRailScrollAreaStyle}>
        <Box style={sideRailContentStyle}>{activePanelContent}</Box>
      </ScrollArea>
    </Stack>
  );
}

function ReaderBookWorkspace({
  book,
  activeSideRailPanel,
  currentSpineItem,
  sectionIndex,
  sectionCount,
  readerUnavailable,
  loadState,
  loadError,
  renderedSection,
  iframeRef,
  isRelinking,
  decks,
  selectedDeckId,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
  canAddActiveAnnotation,
  isImportingActiveAnnotation,
  deletingAnnotationId,
  preferences,
  annotations,
  isFetching,
  selectedAnnotationIds,
  canImportSelected,
  isImportingSelected,
  importableAnnotationIds,
  allImportableSelected,
  importStatusByAnnotationId,
  selectionDraft,
  setPreferences,
  setActiveSideRailPanel,
  onSectionChange,
  onRelink,
  onRequestPermission,
  onIframeLoad,
  onDeckChange,
  onExplainSelection,
  onAddActiveAnnotation,
  onOpenAnnotation,
  onDeleteAnnotation,
  onJumpToLocator,
  onToggleAnnotationSelection,
  onImportSelected,
  onToggleSelectAll,
}: {
  book: ReaderBookHeaderData & { navigationJson: EpubNavigationItem[] };
  activeSideRailPanel: SideRailPanel;
  currentSpineItem: EpubSpineItem | null;
  sectionIndex: number;
  sectionCount: number;
  readerUnavailable: boolean;
  loadState: BookLoadState;
  loadError: string;
  renderedSection: RenderedSectionState | null;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  isRelinking: boolean;
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
  canAddActiveAnnotation: boolean;
  isImportingActiveAnnotation: boolean;
  deletingAnnotationId: number | null;
  preferences: EpubReadingPreferences;
  annotations: ReaderArticleHighlight[];
  isFetching: boolean;
  selectedAnnotationIds: number[];
  canImportSelected: boolean;
  isImportingSelected: boolean;
  importableAnnotationIds: number[];
  allImportableSelected: boolean;
  importStatusByAnnotationId: Record<number, HighlightImportResultStatus>;
  selectionDraft: ReaderSelectionDraft | null;
  setPreferences: React.Dispatch<
    React.SetStateAction<EpubReadingPreferences>
  >;
  setActiveSideRailPanel: (panel: SideRailPanel) => void;
  onSectionChange: (nextIndex: number) => void;
  onRelink: () => void;
  onRequestPermission: () => void;
  onIframeLoad: () => void;
  onDeckChange: (deckId: string | null) => void;
  onExplainSelection: () => void;
  onAddActiveAnnotation?: () => void;
  onOpenAnnotation?: (annotation: ReaderArticleHighlight) => void;
  onDeleteAnnotation: (annotationId: number) => void;
  onJumpToLocator: (locator: EpubBookLocator) => void;
  onToggleAnnotationSelection: (
    annotationId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
}) {
  return (
    <Box style={bookWorkspaceResponsiveStyle}>
      <BookInfoRail
        book={book}
        currentSpineItem={currentSpineItem}
        sectionIndex={sectionIndex}
        sectionCount={sectionCount}
        readerUnavailable={readerUnavailable}
        navigationItems={book.navigationJson}
        isRelinking={isRelinking}
        onSectionChange={onSectionChange}
        onJumpToLocator={onJumpToLocator}
        onRelink={onRelink}
      />
      <BookReaderPanel
        loadState={loadState}
        loadError={loadError}
        title={book.title}
        renderedSection={renderedSection}
        iframeRef={iframeRef}
        isRelinking={isRelinking}
        onRelink={onRelink}
        onRequestPermission={onRequestPermission}
        onIframeLoad={onIframeLoad}
      />

      <BookSideRail
        activePanel={activeSideRailPanel}
        selectionDraft={selectionDraft}
        preferences={preferences}
        decks={decks}
        selectedDeckId={selectedDeckId}
        isExplaining={isExplaining}
        streamError={streamError}
        analysis={analysis}
        explainedAnnotationId={explainedAnnotationId}
        canAddActiveAnnotation={canAddActiveAnnotation}
        isImportingActiveAnnotation={isImportingActiveAnnotation}
        annotations={annotations}
        isFetching={isFetching}
        deletingAnnotationId={deletingAnnotationId}
        selectedAnnotationIds={selectedAnnotationIds}
        canImportSelected={canImportSelected}
        isImportingSelected={isImportingSelected}
        importableAnnotationIds={importableAnnotationIds}
        allImportableSelected={allImportableSelected}
        importStatusByAnnotationId={importStatusByAnnotationId}
        setPreferences={setPreferences}
        onActivePanelChange={setActiveSideRailPanel}
        onDeckChange={onDeckChange}
        onExplainSelection={onExplainSelection}
        onAddActiveAnnotation={onAddActiveAnnotation}
        onOpenAnnotation={onOpenAnnotation}
        onToggleAnnotationSelection={onToggleAnnotationSelection}
        onImportSelected={onImportSelected}
        onToggleSelectAll={onToggleSelectAll}
        onDeleteAnnotation={onDeleteAnnotation}
      />
    </Box>
  );
}

function ReaderBookShell({
  book,
  activeSideRailPanel,
  currentSpineItem,
  sectionIndex,
  sectionCount,
  readerUnavailable,
  loadState,
  loadError,
  renderedSection,
  iframeRef,
  isRelinking,
  decks,
  selectedDeckId,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
  canAddActiveAnnotation,
  isImportingActiveAnnotation,
  deletingAnnotationId,
  preferences,
  annotations,
  isFetching,
  selectedAnnotationIds,
  canImportSelected,
  isImportingSelected,
  importableAnnotationIds,
  allImportableSelected,
  importStatusByAnnotationId,
  selectionDraft,
  setPreferences,
  setActiveSideRailPanel,
  onSectionChange,
  onRelink,
  onRequestPermission,
  onIframeLoad,
  onDeckChange,
  onDeleteAnnotation,
  onJumpToLocator,
  onToggleAnnotationSelection,
  onImportSelected,
  onToggleSelectAll,
  onExplainSelection,
  onAddActiveAnnotation,
  onOpenAnnotation,
}: {
  book: ReaderBookHeaderData & { navigationJson: EpubNavigationItem[] };
  activeSideRailPanel: SideRailPanel;
  currentSpineItem: EpubSpineItem | null;
  sectionIndex: number;
  sectionCount: number;
  readerUnavailable: boolean;
  loadState: BookLoadState;
  loadError: string;
  renderedSection: RenderedSectionState | null;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  isRelinking: boolean;
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
  canAddActiveAnnotation: boolean;
  isImportingActiveAnnotation: boolean;
  deletingAnnotationId: number | null;
  preferences: EpubReadingPreferences;
  annotations: ReaderArticleHighlight[];
  isFetching: boolean;
  selectedAnnotationIds: number[];
  canImportSelected: boolean;
  isImportingSelected: boolean;
  importableAnnotationIds: number[];
  allImportableSelected: boolean;
  importStatusByAnnotationId: Record<number, HighlightImportResultStatus>;
  selectionDraft: ReaderSelectionDraft | null;
  setPreferences: React.Dispatch<
    React.SetStateAction<EpubReadingPreferences>
  >;
  setActiveSideRailPanel: (panel: SideRailPanel) => void;
  onSectionChange: (nextIndex: number) => void;
  onRelink: () => void;
  onRequestPermission: () => void;
  onIframeLoad: () => void;
  onDeckChange: (deckId: string | null) => void;
  onDeleteAnnotation: (annotationId: number) => void;
  onJumpToLocator: (locator: EpubBookLocator) => void;
  onToggleAnnotationSelection: (
    annotationId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
  onExplainSelection: () => void;
  onAddActiveAnnotation?: () => void;
  onOpenAnnotation?: (annotation: ReaderArticleHighlight) => void;
}) {
  return (
    <Box style={readerPageStyle}>
      <ReaderBookWorkspace
        book={book}
        activeSideRailPanel={activeSideRailPanel}
        currentSpineItem={currentSpineItem}
        sectionIndex={sectionIndex}
        sectionCount={sectionCount}
        readerUnavailable={readerUnavailable}
        loadState={loadState}
        loadError={loadError}
        renderedSection={renderedSection}
        iframeRef={iframeRef}
        isRelinking={isRelinking}
        decks={decks}
        selectedDeckId={selectedDeckId}
        isExplaining={isExplaining}
        streamError={streamError}
        analysis={analysis}
        explainedAnnotationId={explainedAnnotationId}
        canAddActiveAnnotation={canAddActiveAnnotation}
        isImportingActiveAnnotation={isImportingActiveAnnotation}
        deletingAnnotationId={deletingAnnotationId}
        preferences={preferences}
        annotations={annotations}
        isFetching={isFetching}
        selectedAnnotationIds={selectedAnnotationIds}
        canImportSelected={canImportSelected}
        isImportingSelected={isImportingSelected}
        importableAnnotationIds={importableAnnotationIds}
        allImportableSelected={allImportableSelected}
        importStatusByAnnotationId={importStatusByAnnotationId}
        selectionDraft={selectionDraft}
        setPreferences={setPreferences}
        setActiveSideRailPanel={setActiveSideRailPanel}
        onSectionChange={onSectionChange}
        onRelink={onRelink}
        onRequestPermission={onRequestPermission}
        onIframeLoad={onIframeLoad}
        onDeckChange={onDeckChange}
        onDeleteAnnotation={onDeleteAnnotation}
        onJumpToLocator={onJumpToLocator}
        onToggleAnnotationSelection={onToggleAnnotationSelection}
        onImportSelected={onImportSelected}
        onToggleSelectAll={onToggleSelectAll}
        onExplainSelection={onExplainSelection}
        onAddActiveAnnotation={onAddActiveAnnotation}
        onOpenAnnotation={onOpenAnnotation}
      />
    </Box>
  );
}

async function findStoredBookRecord(options: {
  publicId: string;
  fingerprint: string;
}): Promise<LocalBookHandleRecord | null> {
  return (
    (await getLocalBookHandleByPublicId(options.publicId)) ??
    (await getLocalBookHandleByFingerprint(options.fingerprint))
  );
}

async function openStoredBookSession(
  record: LocalBookHandleRecord,
  requestPermission: boolean,
): Promise<
  { status: "permission" } | { status: "ready"; session: EpubSession }
> {
  const permission = requestPermission
    ? await ensureLocalBookPermission(record.handle)
    : await queryLocalBookPermission(record.handle);
  const permissionOk =
    permission === true ||
    permission === "granted" ||
    permission === "unsupported";
  if (!permissionOk) {
    return { status: "permission" };
  }

  const file = await record.handle.getFile();
  const session = await openEpubSession(file);
  await session.readManifest();
  return { status: "ready", session };
}

export default function ReaderBookPage({
  initialPreferences,
}: ReaderBookPageProps) {
  const router = useRouter();
  const publicId = readerPublicIdFromQuery(router.query.publicId);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingScrollLocatorRef = useRef<EpubBookLocator | null>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const preferencesSaveTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const preferencesMountedRef = useRef(false);
  const explainAbortRef = useRef<AbortController | null>(null);
  const explainRequestIdRef = useRef(0);
  const autoExplainedSelectionKeyRef = useRef<string | null>(null);
  const [session, setSession] = useState<EpubSession | null>(null);
  const [loadState, setLoadState] = useState<BookLoadState>("checking");
  const [loadError, setLoadError] = useState("");
  const [storedHandle, setStoredHandle] =
    useState<LocalBookHandleRecord | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [renderedSection, setRenderedSection] =
    useState<RenderedSectionState | null>(null);
  const [preferences, setPreferences] = useState<EpubReadingPreferences>(
    () =>
      resolveEpubReadingPreferences(
        initialPreferences ?? DEFAULT_EPUB_READING_PREFERENCES,
      ),
  );
  const [activeSideRailPanel, setActiveSideRailPanel] =
    useState<SideRailPanel>("current");
  const [selectionDraft, setSelectionDraft] =
    useState<ReaderSelectionDraft | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [analysis, setAnalysis] = useState<ReaderHighlightAnalysis | null>(
    null,
  );
  const [explainedAnnotationId, setExplainedAnnotationId] = useState<
    number | null
  >(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(
    null,
  );
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<
    number[]
  >([]);
  const [importStatusByAnnotationId, setImportStatusByAnnotationId] =
    useState<Record<number, HighlightImportResultStatus>>({});
  const [deletingAnnotationId, setDeletingAnnotationId] = useState<
    number | null
  >(null);
  const [isImportingSelected, setIsImportingSelected] = useState(false);
  const [isImportingActiveAnnotation, setIsImportingActiveAnnotation] =
    useState(false);
  const [isRelinking, setIsRelinking] = useState(false);

  const bookQuery = trpc.getReaderBookRoute.useQuery(
    { publicId },
    {
      enabled: publicId.length > 0,
      refetchOnWindowFocus: false,
    },
  );
  const updateProgress = trpc.updateReaderBookProgressRoute.useMutation();
  const updateReaderPreferences =
    trpc.updateReaderBookPreferencesRoute.useMutation();
  const updateReaderPreferencesRef = useRef(
    updateReaderPreferences.mutate,
  );
  const deleteAnnotation =
    trpc.deleteReaderBookAnnotationRoute.useMutation();
  const importAnnotations =
    trpc.importReaderBookAnnotationsToDeckRoute.useMutation();

  const book = bookQuery.data?.book;
  const annotations = useMemo(() => {
    return bookQuery.data?.annotations ?? [];
  }, [bookQuery.data]);
  const decks = useMemo(() => {
    return bookQuery.data?.decks ?? [];
  }, [bookQuery.data?.decks]);
  const spineJson = book?.spineJson ?? [];
  const currentSpineItem = spineJson[sectionIndex] ?? null;
  const currentSectionText = renderedSection?.text ?? "";

  useEffect(() => {
    updateReaderPreferencesRef.current = updateReaderPreferences.mutate;
  }, [updateReaderPreferences.mutate]);

  useEffect(() => {
    if (!preferencesMountedRef.current) {
      preferencesMountedRef.current = true;
      return;
    }

    if (preferencesSaveTimeoutRef.current) {
      clearTimeout(preferencesSaveTimeoutRef.current);
    }

    preferencesSaveTimeoutRef.current = setTimeout(() => {
      updateReaderPreferencesRef.current(
        resolveEpubReadingPreferences(preferences),
      );
      preferencesSaveTimeoutRef.current = null;
    }, 500);

    return () => {
      if (preferencesSaveTimeoutRef.current) {
        clearTimeout(preferencesSaveTimeoutRef.current);
        preferencesSaveTimeoutRef.current = null;
      }
    };
  }, [preferences]);

  useEffect(() => {
    setSelectedDeckId((current) => {
      const firstDeck = decks[0];
      if (!firstDeck) {
        return null;
      }

      const currentDeckExists =
        current !== null &&
        decks.some((deck) => String(deck.id) === current);
      if (currentDeckExists) {
        return current;
      }

      return String(firstDeck.id);
    });
  }, [decks]);

  const currentLocator = useCallback((): EpubBookLocator | null => {
    if (!book || !currentSpineItem) {
      return null;
    }

    const progression = currentProgressionFromFrame(iframeRef.current);
    const totalProgression =
      spineJson.length > 0
        ? Math.max(
            0,
            Math.min(1, (sectionIndex + progression) / spineJson.length),
          )
        : 0;
    const chapterTitle =
      currentSpineItem.title ?? `Section ${sectionIndex + 1}`;

    return {
      href: currentSpineItem.href,
      title: chapterTitle,
      chapterTitle,
      sectionIndex,
      progression,
      totalProgression,
    };
  }, [book, currentSpineItem, sectionIndex, spineJson.length]);

  const scheduleProgressSave = useCallback(() => {
    if (!book || progressTimeoutRef.current) {
      return;
    }

    progressTimeoutRef.current = setTimeout(() => {
      progressTimeoutRef.current = null;
      const locator = currentLocator();
      if (!locator) {
        return;
      }

      updateProgress.mutate({
        publicId: book.publicId,
        lastLocatorJson: locator,
      });
    }, 1200);
  }, [book, currentLocator, updateProgress]);

  const applyCurrentSectionHighlights = useCallback(() => {
    const body = iframeRef.current?.contentDocument?.body;
    if (!body || !currentSpineItem || !renderedSection) {
      return;
    }

    clearRenderedArticleHighlights(body);
    const sectionAnnotations = annotations.filter((annotation) =>
      isAnnotationInSection(annotation, currentSpineItem.href),
    );
    const ranges = buildSavedArticleHighlightRanges({
      articleText: renderedSection.text,
      highlights: sectionAnnotations,
    });
    applyRenderedArticleHighlights(body, ranges);
  }, [annotations, currentSpineItem, renderedSection]);

  const jumpToLocator = useCallback(
    (locator: EpubBookLocator) => {
      const nextIndex = findSectionIndex(spineJson, locator.href);
      pendingScrollLocatorRef.current = locator;
      explainAbortRef.current?.abort();
      autoExplainedSelectionKeyRef.current = null;
      setSectionIndex(nextIndex);
      setSelectionDraft(null);
      setAnalysis(null);
      setStreamError("");
      setIsExplaining(false);
      setExplainedAnnotationId(null);
    },
    [spineJson],
  );

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
      explainAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (session) {
        void session.close();
      }
    };
  }, [session]);

  useEffect(() => {
    return () => {
      if (renderedSection) {
        renderedSection.objectUrls.forEach(URL.revokeObjectURL);
      }
    };
  }, [renderedSection]);

  useEffect(() => {
    let cancelled = false;

    async function loadStoredHandle() {
      if (!book) {
        return;
      }

      setLoadState("checking");
      setLoadError("");

      try {
        const record = await findStoredBookRecord({
          publicId: book.publicId,
          fingerprint: book.fingerprint,
        });
        if (cancelled) {
          return;
        }

        if (!record) {
          setStoredHandle(null);
          setLoadState("missing");
          return;
        }

        setStoredHandle(record);
        setLoadState("loading");
        const opened = await openStoredBookSession(record, false);
        if (cancelled) {
          if (opened.status === "ready") {
            await opened.session.close();
          }
          return;
        }

        if (opened.status === "permission") {
          setLoadState("permission");
          return;
        }

        setSession((previous) => {
          if (previous) {
            void previous.close();
          }
          return opened.session;
        });
        const initialLocator = book.progress?.lastLocatorJson ?? null;
        pendingScrollLocatorRef.current = initialLocator;
        setSectionIndex(
          findSectionIndex(book.spineJson, initialLocator?.href),
        );
        setLoadState("ready");
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(
            mutationErrorMessage(error, "Couldn't open this local file."),
          );
        }
      }
    }

    loadStoredHandle();

    return () => {
      cancelled = true;
    };
  }, [book?.fingerprint, book?.publicId]);

  useEffect(() => {
    let cancelled = false;

    async function renderCurrentSection() {
      if (!session || !currentSpineItem) {
        return;
      }

      setRenderedSection(null);
      try {
        const rendered = await session.renderSection(
          currentSpineItem.href,
          preferences,
        );
        if (cancelled) {
          rendered.objectUrls.forEach(URL.revokeObjectURL);
          return;
        }

        setRenderedSection((previous) => {
          previous?.objectUrls.forEach(URL.revokeObjectURL);
          return rendered;
        });
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(
            mutationErrorMessage(error, "Couldn't render this section."),
          );
        }
      }
    }

    renderCurrentSection();

    return () => {
      cancelled = true;
    };
  }, [currentSpineItem, preferences, session]);

  useEffect(() => {
    applyCurrentSectionHighlights();
  }, [applyCurrentSectionHighlights]);

  const explainSelectionDraft = useCallback(
    async (draft: ReaderSelectionDraft) => {
      if (!book || !currentSpineItem) {
        return;
      }

      const locator = currentLocator();
      if (!locator) {
        return;
      }

      const requestId = explainRequestIdRef.current + 1;
      const controller = new AbortController();
      const isCurrentRequest = () =>
        explainRequestIdRef.current === requestId &&
        !controller.signal.aborted;

      explainRequestIdRef.current = requestId;
      explainAbortRef.current?.abort();
      explainAbortRef.current = controller;
      setIsExplaining(true);
      setStreamError("");
      setAnalysis(null);
      setExplainedAnnotationId(null);

      try {
        const response = await fetch(
          "/api/reader/book-highlight-explain-stream",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicId: book.publicId,
              selectedText: draft.selectedText,
              contextBefore: draft.contextBefore,
              contextAfter: draft.contextAfter,
              occurrenceHint: draft.occurrenceHint,
              sectionText: currentSectionText,
              locatorJson: locator,
              chapterTitle: locator.chapterTitle,
              progression: locator.totalProgression,
            }),
            signal: controller.signal,
          },
        );

        if (!hasExplainSelectionStream(response)) {
          throw new Error(await response.text());
        }

        await readBookExplainStream(response, {
          onAnnotationId: (annotationId) => {
            if (!isCurrentRequest()) {
              return;
            }

            setExplainedAnnotationId(annotationId);
            setSelectedAnnotationIds((current) =>
              Array.from(new Set([...current, annotationId])),
            );
          },
          onAnalysis: (nextAnalysis) => {
            if (!isCurrentRequest()) {
              return;
            }

            setAnalysis(nextAnalysis);
          },
          onDone: () => {
            if (isCurrentRequest()) {
              setIsExplaining(false);
            }
          },
          onError: (message) => {
            if (isCurrentRequest()) {
              setStreamError(message);
            }
          },
        });
      } catch (error: unknown) {
        const message = resolveExplainSelectionErrorMessage(
          error,
          controller.signal.aborted,
        );
        if (message && isCurrentRequest()) {
          setStreamError(message);
        }
      } finally {
        if (isCurrentRequest()) {
          setIsExplaining(false);
          bookQuery.refetch();
        }
        if (explainAbortRef.current === controller) {
          explainAbortRef.current = null;
        }
      }
    },
    [
      book,
      bookQuery,
      currentLocator,
      currentSectionText,
      currentSpineItem,
    ],
  );

  const handleFrameSelection = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !renderedSection) {
      setSelectionDraft(null);
      autoExplainedSelectionKeyRef.current = null;
      return;
    }

    const nextDraft = buildSelectionDraftFromFrame({
      iframe,
      sectionText: renderedSection.text,
    });
    setSelectionDraft(nextDraft);
    if (!nextDraft) {
      autoExplainedSelectionKeyRef.current = null;
      return;
    }

    setActiveSideRailPanel("current");

    if (!currentSpineItem || !isAutoExplainSelection(nextDraft)) {
      return;
    }

    const nextSelectionKey = selectionDraftKey({
      draft: nextDraft,
      sectionHref: currentSpineItem.href,
    });
    if (autoExplainedSelectionKeyRef.current === nextSelectionKey) {
      return;
    }

    autoExplainedSelectionKeyRef.current = nextSelectionKey;
    void explainSelectionDraft(nextDraft);
  }, [currentSpineItem, explainSelectionDraft, renderedSection]);

  const handleSectionChange = useCallback(
    async (nextIndex: number) => {
      const locator = currentLocator();
      if (book && locator) {
        await updateProgress.mutateAsync({
          publicId: book.publicId,
          lastLocatorJson: locator,
        });
      }

      setSectionIndex(
        Math.max(0, Math.min(spineJson.length - 1, nextIndex)),
      );
      explainAbortRef.current?.abort();
      autoExplainedSelectionKeyRef.current = null;
      setSelectionDraft(null);
      setAnalysis(null);
      setStreamError("");
      setIsExplaining(false);
      setExplainedAnnotationId(null);
    },
    [book, currentLocator, spineJson.length, updateProgress],
  );

  const handleReaderKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const direction = readerKeyboardDirection(event);
      if (direction === 0 || loadState !== "ready") {
        return;
      }

      event.preventDefault();
      const nextIndex = Math.max(
        0,
        Math.min(spineJson.length - 1, sectionIndex + direction),
      );
      if (nextIndex === sectionIndex) {
        return;
      }

      void handleSectionChange(nextIndex);
    },
    [handleSectionChange, loadState, sectionIndex, spineJson.length],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleReaderKeyDown);
    return () => {
      window.removeEventListener("keydown", handleReaderKeyDown);
    };
  }, [handleReaderKeyDown]);

  const activateAnnotation = useCallback(
    (annotation: ReaderArticleHighlight) => {
      explainAbortRef.current?.abort();
      autoExplainedSelectionKeyRef.current = null;
      setIsExplaining(false);
      setSelectionDraft(selectionDraftFromAnnotation(annotation));
      setExplainedAnnotationId(annotation.id);
      setAnalysis(annotationAnalysis(annotation));
      setActiveSideRailPanel("current");
      setSelectedAnnotationIds((current) =>
        Array.from(new Set([...current, annotation.id])),
      );

      if (
        annotation.status === "error" &&
        annotation.errorMessage.trim().length > 0
      ) {
        setStreamError(annotation.errorMessage);
        return;
      }

      setStreamError("");
    },
    [],
  );

  const handleFrameHighlightClick = useCallback(
    (event: MouseEvent) => {
      const highlightMark = closestElementFromEventTarget(
        event.target,
        "mark[data-reader-highlight='saved'][data-highlight-id]",
      );
      if (!highlightMark) {
        return;
      }

      const rawId = highlightMark.getAttribute("data-highlight-id");
      if (!rawId) {
        return;
      }

      const annotationId = Number.parseInt(rawId, 10);
      if (!Number.isFinite(annotationId)) {
        return;
      }

      const annotation = annotations.find(
        (item) => item.id === annotationId,
      );
      if (!annotation) {
        return;
      }

      event.preventDefault();
      iframeRef.current?.contentWindow?.getSelection()?.removeAllRanges();
      activateAnnotation(annotation);
    },
    [activateAnnotation, annotations],
  );

  const handleIframeLoad = useCallback(() => {
    const document = iframeRef.current?.contentDocument;
    if (!document) {
      return;
    }

    document.addEventListener("click", handleFrameHighlightClick);
    document.addEventListener("mouseup", handleFrameSelection);
    document.addEventListener("keyup", handleFrameSelection);
    document.addEventListener("keydown", handleReaderKeyDown);
    document.addEventListener("scroll", scheduleProgressSave, true);
    applyCurrentSectionHighlights();
    scrollFrameToProgression(
      iframeRef.current,
      pendingScrollLocatorRef.current,
    );
    pendingScrollLocatorRef.current = null;
    scheduleProgressSave();
  }, [
    applyCurrentSectionHighlights,
    handleFrameHighlightClick,
    handleFrameSelection,
    handleReaderKeyDown,
    scheduleProgressSave,
  ]);

  const handleExplainSelection = async () => {
    if (!canExplainSelection(selectionDraft, isExplaining)) {
      return;
    }

    await explainSelectionDraft(selectionDraft);
  };

  const handleToggleAnnotationSelection = (
    annotationId: number,
    isSelected: boolean,
  ) => {
    setSelectedAnnotationIds((current) => {
      if (isSelected) {
        return Array.from(new Set([...current, annotationId]));
      }

      return current.filter((id) => id !== annotationId);
    });
  };

  const importAnnotationIds = async (annotationIds: number[]) => {
    if (!book || !selectedDeckId) {
      return null;
    }

    const result = await importAnnotations.mutateAsync({
      publicId: book.publicId,
      deckId: Number(selectedDeckId),
      annotationIds,
    });
    setImportStatusByAnnotationId((current) => ({
      ...current,
      ...Object.fromEntries(
        result.results.map((item) => [item.annotationId, item.status]),
      ),
    }));
    bookQuery.refetch();
    return result;
  };

  const handleImportSelected = async () => {
    setIsImportingSelected(true);
    try {
      await importAnnotationIds(selectedAnnotationIds);
      setSelectedAnnotationIds([]);
    } catch (error: unknown) {
      notifications.show({
        title: "Add failed",
        message: mutationErrorMessage(error, "Couldn't add highlights."),
        color: "red",
      });
    } finally {
      setIsImportingSelected(false);
    }
  };

  const handleImportActiveAnnotation = async () => {
    if (explainedAnnotationId === null) {
      return;
    }

    setIsImportingActiveAnnotation(true);
    try {
      const result = await importAnnotationIds([explainedAnnotationId]);
      const status = result?.results[0]?.status;
      if (!status) {
        return;
      }

      notifications.show({
        title: "Import",
        message: readerBookImportStatusLabel(status),
        color: readerBookImportStatusColor(status),
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Add failed",
        message: mutationErrorMessage(error, "Couldn't add highlight."),
        color: "red",
      });
    } finally {
      setIsImportingActiveAnnotation(false);
    }
  };

  const handleDeleteAnnotation = async (annotationId: number) => {
    if (!book) {
      return;
    }

    setDeletingAnnotationId(annotationId);
    try {
      await deleteAnnotation.mutateAsync({
        publicId: book.publicId,
        annotationId,
      });
      setSelectedAnnotationIds((current) =>
        current.filter((id) => id !== annotationId),
      );
      if (explainedAnnotationId === annotationId) {
        setExplainedAnnotationId(null);
        setAnalysis(null);
      }
      bookQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Delete failed",
        message: mutationErrorMessage(error, "Couldn't delete highlight."),
        color: "red",
      });
    } finally {
      setDeletingAnnotationId(null);
    }
  };

  const handleToggleSelectAll = () => {
    const importableIds = importableAnnotationIdsFrom(annotations);
    const allSelected = areAllImportableAnnotationsSelected({
      importableAnnotationIds: importableIds,
      selectedAnnotationIds,
    });

    setSelectedAnnotationIds(allSelected ? [] : importableIds);
  };

  const handleRelink = async () => {
    if (!book) {
      return;
    }

    if (!isFileSystemAccessSupported()) {
      notifications.show({
        title: "Chrome required",
        message: "Open EPUB books in Chrome.",
        color: "red",
      });
      return;
    }

    setIsRelinking(true);
    try {
      await requestPersistentReaderStorage();
      const picked = await openEpubFileWithPicker();
      const { manifest, coverDataUrl } = await readEpubManifest(
        picked.file,
      );
      if (!canRelinkReaderBook({ book, manifest })) {
        throw new Error("Choose the same EPUB.");
      }

      const linkedManifest = manifestForRelinkedReaderBook({
        book,
        manifest,
      });
      const record = await saveLocalBookHandle({
        fingerprint: book.fingerprint,
        serverPublicId: book.publicId,
        file: picked.file,
        handle: picked.handle,
      });
      await saveLocalManifestCache(linkedManifest);
      if (coverDataUrl) {
        await saveLocalCoverCache({
          fingerprint: book.fingerprint,
          coverDataUrl,
        });
      }
      setStoredHandle(record);
      const opened = await openStoredBookSession(record, false);
      if (opened.status === "permission") {
        setLoadState("permission");
        return;
      }

      setSession((previous) => {
        if (previous) {
          void previous.close();
        }
        return opened.session;
      });
      const initialLocator = book.progress?.lastLocatorJson ?? null;
      pendingScrollLocatorRef.current = initialLocator;
      setSectionIndex(
        findSectionIndex(book.spineJson, initialLocator?.href),
      );
      setLoadState("ready");
      notifications.show({
        title: "Book linked",
        message: "Local file is ready.",
        color: "green",
      });
      bookQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Relink failed",
        message: mutationErrorMessage(error, "Couldn't link this file."),
        color: "red",
      });
    } finally {
      setIsRelinking(false);
    }
  };

  const handleRequestPermission = async () => {
    if (!storedHandle) {
      return;
    }

    setLoadState("loading");
    try {
      const opened = await openStoredBookSession(storedHandle, true);
      if (opened.status === "permission") {
        setLoadState("permission");
        return;
      }

      setSession((previous) => {
        if (previous) {
          void previous.close();
        }
        return opened.session;
      });
      setLoadState("ready");
    } catch (error: unknown) {
      setLoadState("error");
      setLoadError(
        mutationErrorMessage(error, "Couldn't open this local file."),
      );
    }
  };

  const importableAnnotationIds = importableAnnotationIdsFrom(annotations);
  const allImportableSelected = areAllImportableAnnotationsSelected({
    importableAnnotationIds,
    selectedAnnotationIds,
  });
  const canImportSelected = canImportReaderAnnotations({
    selectedAnnotationIds,
    selectedDeckId,
  });
  const activeAnnotation = activeAnnotationFrom(
    annotations,
    explainedAnnotationId,
  );
  const activeImportStatus = activeImportStatusFrom({
    explainedAnnotationId,
    importStatusByAnnotationId,
  });
  const activeAnnotationAlreadyAdded = isActiveAnnotationAlreadyAdded({
    activeAnnotation,
    activeImportStatus,
  });
  const canAddActiveAnnotation = canAddActiveAnnotationToDeck({
    explainedAnnotationId,
    selectedDeckId,
    analysis,
    activeAnnotationAlreadyAdded,
    isExplaining,
    isImportingActiveAnnotation,
  });
  const addActiveAnnotationHandler = activeAnnotationHandlerOrUndefined({
    explainedAnnotationId,
    activeAnnotationAlreadyAdded,
    handler: handleImportActiveAnnotation,
  });

  if (bookQuery.isError) {
    return (
      <BookQueryErrorPanel
        errorMessage={mutationErrorMessage(
          bookQuery.error,
          "Couldn't load this book.",
        )}
      />
    );
  }

  if (bookQuery.isLoading || !book) {
    return <BookLoadingPanel />;
  }

  const readerUnavailable = loadState !== "ready";

  return (
    <ReaderBookShell
      book={book}
      activeSideRailPanel={activeSideRailPanel}
      currentSpineItem={currentSpineItem}
      sectionIndex={sectionIndex}
      sectionCount={spineJson.length}
      readerUnavailable={readerUnavailable}
      loadState={loadState}
      loadError={loadError}
      renderedSection={renderedSection}
      iframeRef={iframeRef}
      isRelinking={isRelinking}
      decks={decks}
      selectedDeckId={selectedDeckId}
      isExplaining={isExplaining}
      streamError={streamError}
      analysis={analysis}
      explainedAnnotationId={explainedAnnotationId}
      canAddActiveAnnotation={canAddActiveAnnotation}
      isImportingActiveAnnotation={isImportingActiveAnnotation}
      deletingAnnotationId={deletingAnnotationId}
      preferences={preferences}
      annotations={annotations}
      isFetching={bookQuery.isFetching}
      selectedAnnotationIds={selectedAnnotationIds}
      canImportSelected={canImportSelected}
      isImportingSelected={isImportingSelected}
      importableAnnotationIds={importableAnnotationIds}
      allImportableSelected={allImportableSelected}
      importStatusByAnnotationId={importStatusByAnnotationId}
      selectionDraft={selectionDraft}
      setPreferences={setPreferences}
      setActiveSideRailPanel={setActiveSideRailPanel}
      onSectionChange={handleSectionChange}
      onRelink={handleRelink}
      onRequestPermission={handleRequestPermission}
      onIframeLoad={handleIframeLoad}
      onDeckChange={setSelectedDeckId}
      onDeleteAnnotation={handleDeleteAnnotation}
      onJumpToLocator={jumpToLocator}
      onToggleAnnotationSelection={handleToggleAnnotationSelection}
      onImportSelected={handleImportSelected}
      onToggleSelectAll={handleToggleSelectAll}
      onExplainSelection={handleExplainSelection}
      onAddActiveAnnotation={addActiveAnnotationHandler}
      onOpenAnnotation={activateAnnotation}
    />
  );
}
export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const session = await getSession({ req: context.req });
  if (!session?.user?.email) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const userSettings = await getUserSettingsFromEmail(session.user.email);
  if (!userSettings) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const initialPreferences = resolveEpubReadingPreferences({
    fontSize: userSettings.readerBookFontSize,
    lineHeight: userSettings.readerBookLineHeight,
    columnWidth: userSettings.readerBookColumnWidth,
  });

  return { props: { initialPreferences } };
}
