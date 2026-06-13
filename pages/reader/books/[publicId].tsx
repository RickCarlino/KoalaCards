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
  formatReaderDateTime,
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
  Tabs,
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

type ReaderBookBookmarkView = {
  id: number;
  locatorJson: EpubBookLocator;
  label: string;
  chapterTitle: string;
  progression: number;
  createdAt: Date;
};

type ReaderDeckOption = {
  id: number;
  name: string;
};

type ReaderBookInspectorTab = "highlights" | "bookmarks" | "contents";

const DEFAULT_PREFERENCES: EpubReadingPreferences = {
  fontSize: 18,
  lineHeight: 1.65,
  columnWidth: 720,
  flow: "scrolled",
};

const SELECTION_CONTEXT_RADIUS = 60;
const PAGINATED_KEYBOARD_PAGE_GAP = 42;
const readerPageStyle: React.CSSProperties = {
  width: "100%",
  paddingInline: "clamp(10px, 2.2vw, 28px)",
  paddingTop: "clamp(10px, 1.5vw, 18px)",
  paddingBottom: "clamp(16px, 2.6vw, 30px)",
};
const bookWorkspaceStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
  gap: "clamp(10px, 1.5vw, 18px)",
  alignItems: "start",
};
const bookWorkspaceResponsiveStyle: React.CSSProperties = {
  ...bookWorkspaceStyle,
  gridTemplateColumns: "minmax(0, 1fr) minmax(min(100%, 280px), 360px)",
};
const bookFrameStyle: React.CSSProperties = {
  height: "calc(100svh - var(--app-shell-header-offset, 60px) - 118px)",
  minHeight: 520,
  border: `1px solid ${readerPanelBorderColor}`,
  borderRadius: 8,
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
  position: "sticky",
  top: "calc(var(--app-shell-header-offset, 60px) + 12px)",
  maxHeight: "calc(100svh - var(--app-shell-header-offset, 60px) - 24px)",
  overflow: "hidden",
};
const sideRailPanelHeight =
  "calc(100svh - var(--app-shell-header-offset, 60px) - 82px)";
const openingBookStates = new Set<BookLoadState>(["checking", "loading"]);
const readerFlowValues = new Set<EpubReadingPreferences["flow"]>([
  "scrolled",
  "paginated",
]);
const readerBookInspectorTabs = new Set<ReaderBookInspectorTab>([
  "highlights",
  "bookmarks",
  "contents",
]);

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

function isReaderFlow(
  value: string,
): value is EpubReadingPreferences["flow"] {
  return readerFlowValues.has(value as EpubReadingPreferences["flow"]);
}

function isReaderBookInspectorTab(
  value: string | null,
): value is ReaderBookInspectorTab {
  return (
    typeof value === "string" &&
    readerBookInspectorTabs.has(value as ReaderBookInspectorTab)
  );
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
  flow: EpubReadingPreferences["flow"],
): number {
  const document = iframe?.contentDocument;
  const scrollingElement = document?.scrollingElement;
  if (!scrollingElement) {
    return 0;
  }

  if (flow === "paginated") {
    const maxScroll = Math.max(
      1,
      scrollingElement.scrollWidth - scrollingElement.clientWidth,
    );
    return scrollingElement.scrollLeft / maxScroll;
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
  flow: EpubReadingPreferences["flow"],
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
  if (flow === "paginated") {
    const maxScroll = Math.max(
      0,
      scrollingElement.scrollWidth - scrollingElement.clientWidth,
    );
    scrollingElement.scrollLeft = maxScroll * progression;
    return;
  }

  const maxScroll = Math.max(
    0,
    scrollingElement.scrollHeight - scrollingElement.clientHeight,
  );
  scrollingElement.scrollTop = maxScroll * progression;
}

function pageFrameHorizontally(
  iframe: HTMLIFrameElement | null,
  direction: -1 | 1,
): boolean {
  const scrollingElement = iframe?.contentDocument?.scrollingElement;
  if (!scrollingElement) {
    return false;
  }

  const maxScroll = Math.max(
    0,
    scrollingElement.scrollWidth - scrollingElement.clientWidth,
  );
  if (maxScroll === 0) {
    return false;
  }

  const currentScroll = scrollingElement.scrollLeft;
  const pageWidth = Math.max(
    1,
    scrollingElement.clientWidth - PAGINATED_KEYBOARD_PAGE_GAP,
  );
  const nextScroll = Math.max(
    0,
    Math.min(maxScroll, currentScroll + pageWidth * direction),
  );
  if (Math.abs(nextScroll - currentScroll) < 1) {
    return false;
  }

  scrollingElement.scrollLeft = nextScroll;
  return true;
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

function ReaderBookHeader({ book }: { book: ReaderBookHeaderData }) {
  const hasAuthor = book.author.trim().length > 0;

  return (
    <Group justify="space-between" align="flex-start" wrap="wrap">
      <Stack gap={2} style={{ minWidth: 0, flex: "1 1 360px" }}>
        <Anchor component={Link} href="/reader" size="sm">
          Reader
        </Anchor>
        <Text size="xl" fw={700} c={readerHeadingColor} lineClamp={2}>
          {book.title}
        </Text>
        {hasAuthor && (
          <Text size="sm" c="dimmed" lineClamp={1}>
            {book.author}
          </Text>
        )}
      </Stack>
    </Group>
  );
}

function SectionNavigation({
  currentSpineItem,
  sectionIndex,
  sectionCount,
  readerUnavailable,
  onSectionChange,
}: {
  currentSpineItem: EpubSpineItem | null;
  sectionIndex: number;
  sectionCount: number;
  readerUnavailable: boolean;
  onSectionChange: (nextIndex: number) => void;
}) {
  const previousDisabled = readerUnavailable || sectionIndex <= 0;
  const nextDisabled =
    readerUnavailable || sectionIndex >= sectionCount - 1;
  const sectionTitle =
    currentSpineItem?.title ?? `Section ${sectionIndex + 1}`;

  return (
    <Group justify="space-between" wrap="wrap" gap="xs">
      <Group gap="xs" wrap="wrap">
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          disabled={previousDisabled}
          onClick={() => onSectionChange(sectionIndex - 1)}
        >
          Previous
        </Button>
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          disabled={nextDisabled}
          onClick={() => onSectionChange(sectionIndex + 1)}
        >
          Next
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        {sectionTitle} · {sectionIndex + 1} / {sectionCount}
      </Text>
    </Group>
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
  currentSpineItem,
  sectionIndex,
  sectionCount,
  readerUnavailable,
  loadState,
  loadError,
  title,
  renderedSection,
  iframeRef,
  isRelinking,
  onSectionChange,
  onRelink,
  onRequestPermission,
  onIframeLoad,
}: {
  currentSpineItem: EpubSpineItem | null;
  sectionIndex: number;
  sectionCount: number;
  readerUnavailable: boolean;
  loadState: BookLoadState;
  loadError: string;
  title: string;
  renderedSection: RenderedSectionState | null;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  isRelinking: boolean;
  onSectionChange: (nextIndex: number) => void;
  onRelink: () => void;
  onRequestPermission: () => void;
  onIframeLoad: () => void;
}) {
  return (
    <ReaderPanel gap="xs">
      <SectionNavigation
        currentSpineItem={currentSpineItem}
        sectionIndex={sectionIndex}
        sectionCount={sectionCount}
        readerUnavailable={readerUnavailable}
        onSectionChange={onSectionChange}
      />
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
    </ReaderPanel>
  );
}

function HighlightSelectionPanel({
  selectionDraft,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
  deletingAnnotationId,
  onExplainSelection,
  onDeleteAnnotation,
}: {
  selectionDraft: ReaderSelectionDraft | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
  deletingAnnotationId: number | null;
  onExplainSelection: () => void;
  onDeleteAnnotation: (annotationId: number) => void;
}) {
  const deleteAnnotationId = explainedAnnotationId;
  const deleteHighlight =
    deleteAnnotationId === null
      ? undefined
      : () => onDeleteAnnotation(deleteAnnotationId);
  const canDeleteHighlight = deleteAnnotationId !== null;
  const isDeletingHighlight =
    deleteAnnotationId !== null &&
    deletingAnnotationId === deleteAnnotationId;
  const hasSelectionPanelState =
    selectionDraft !== null ||
    isExplaining ||
    streamError.trim().length > 0 ||
    analysis !== null ||
    canDeleteHighlight;

  if (!hasSelectionPanelState) {
    return null;
  }

  return (
    <Stack
      gap="sm"
      style={{
        borderBottom: `1px solid ${readerDividerColor}`,
        paddingBottom: 10,
      }}
    >
      {selectionDraft ? (
        <Stack gap={6}>
          <Text size="xs" c="dimmed">
            Selected
          </Text>
          <Text
            size="sm"
            fw={700}
            c={readerHeadingColor}
            style={{ overflowWrap: "anywhere" }}
          >
            {selectionDraft.selectedText}
          </Text>
          <Button
            size="compact-sm"
            color="grape"
            onClick={onExplainSelection}
            loading={isExplaining}
            disabled={isExplaining}
          >
            Explain
          </Button>
        </Stack>
      ) : null}
      <ExplainSelectionCard
        isExplaining={isExplaining}
        streamError={streamError}
        analysis={analysis}
        onDeleteHighlight={deleteHighlight}
        canDeleteHighlight={canDeleteHighlight}
        isDeletingHighlight={isDeletingHighlight}
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
    <Group gap="xs" align="center" wrap="wrap">
      <Select
        aria-label="Deck"
        placeholder="Deck"
        size="xs"
        value={selectedDeckId}
        onChange={onDeckChange}
        data={deckOptions}
        style={{ flex: "1 1 150px", minWidth: 0 }}
      />
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
  );
}

function ContentsPanel({
  items,
  isRelinking,
  preferences,
  setPreferences,
  onJumpToLocator,
  onRelink,
}: {
  items: EpubNavigationItem[];
  isRelinking: boolean;
  preferences: EpubReadingPreferences;
  setPreferences: React.Dispatch<
    React.SetStateAction<EpubReadingPreferences>
  >;
  onJumpToLocator: (locator: EpubBookLocator) => void;
  onRelink: () => void;
}) {
  return (
    <ReaderPanel
      style={{ height: "100%", minHeight: 0, overflow: "hidden" }}
    >
      <Stack gap="md" style={{ height: "100%", minHeight: 0 }}>
        <ReadingPreferencesControls
          preferences={preferences}
          setPreferences={setPreferences}
        />
        <Stack
          gap="xs"
          style={{
            borderTop: `1px solid ${readerDividerColor}`,
            paddingTop: 10,
            flex: "1 1 auto",
            minHeight: 0,
          }}
        >
          <Group justify="space-between" align="center" gap="xs">
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
          <ScrollArea style={{ flex: "1 1 auto", minHeight: 0 }}>
            <Box pr={4}>
              <NavigationList
                items={items}
                onJump={(href) => {
                  onJumpToLocator({ href, progression: 0 });
                }}
              />
            </Box>
          </ScrollArea>
        </Stack>
      </Stack>
    </ReaderPanel>
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
      <Text size="sm" fw={700} c={readerHeadingColor}>
        Reading
      </Text>
      <SegmentedControl
        value={preferences.flow}
        onChange={(value) => {
          if (!isReaderFlow(value)) {
            return;
          }

          setPreferences((current) => ({
            ...current,
            flow: value,
          }));
        }}
        data={[
          { value: "scrolled", label: "Scroll" },
          { value: "paginated", label: "Pages" },
        ]}
        size="xs"
        color="pink"
        fullWidth
      />
      <Text size="xs" c="dimmed">
        Font size
      </Text>
      <Slider
        min={14}
        max={26}
        step={1}
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
        min={1.25}
        max={2}
        step={0.05}
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
        min={520}
        max={900}
        step={20}
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

function bookmarkDisplayLabel(bookmark: ReaderBookBookmarkView): string {
  return (
    bookmark.label ||
    bookmark.chapterTitle ||
    bookmark.locatorJson.title ||
    "Bookmark"
  );
}

function BookmarksPanel({
  bookmarks,
  readerUnavailable,
  isAddingBookmark,
  deletingBookmarkId,
  onAddBookmark,
  onJumpToLocator,
  onDeleteBookmark,
}: {
  bookmarks: ReaderBookBookmarkView[];
  readerUnavailable: boolean;
  isAddingBookmark: boolean;
  deletingBookmarkId: number | null;
  onAddBookmark: () => void;
  onJumpToLocator: (locator: EpubBookLocator) => void;
  onDeleteBookmark: (bookmarkId: number) => void;
}) {
  return (
    <ReaderPanel>
      <Stack gap="xs">
        <Group justify="space-between" align="center" gap="xs">
          <Text size="sm" fw={700} c={readerHeadingColor}>
            Bookmarks
          </Text>
          <Button
            variant="subtle"
            color="pink"
            size="compact-xs"
            onClick={onAddBookmark}
            loading={isAddingBookmark}
            disabled={readerUnavailable}
          >
            Bookmark
          </Button>
        </Group>
        {bookmarks.length === 0 && (
          <Text size="sm" c="dimmed">
            No bookmarks yet.
          </Text>
        )}
        {bookmarks.map((bookmark) => (
          <Stack
            key={bookmark.id}
            gap={4}
            style={{
              borderTop: `1px solid ${readerDividerColor}`,
              paddingTop: 8,
            }}
          >
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              justify="flex-start"
              onClick={() => onJumpToLocator(bookmark.locatorJson)}
              style={{ whiteSpace: "normal" }}
            >
              {bookmarkDisplayLabel(bookmark)}
            </Button>
            <Group justify="space-between" gap="xs">
              <Text size="xs" c="dimmed">
                {Math.round(bookmark.progression * 100)}% ·{" "}
                {formatReaderDateTime(bookmark.createdAt)}
              </Text>
              <Button
                variant="subtle"
                color="red"
                size="compact-xs"
                loading={deletingBookmarkId === bookmark.id}
                onClick={() => onDeleteBookmark(bookmark.id)}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        ))}
      </Stack>
    </ReaderPanel>
  );
}

function HighlightsPanel({
  selectionDraft,
  decks,
  selectedDeckId,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
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
  onExplainSelection,
  onToggleAnnotationSelection,
  onImportSelected,
  onToggleSelectAll,
  onDeleteAnnotation,
}: {
  selectionDraft: ReaderSelectionDraft | null;
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
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
  onExplainSelection: () => void;
  onToggleAnnotationSelection: (
    annotationId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
  onDeleteAnnotation: (annotationId: number) => void;
}) {
  return (
    <ReaderPanel>
      <Stack gap="sm">
        <HighlightSelectionPanel
          selectionDraft={selectionDraft}
          isExplaining={isExplaining}
          streamError={streamError}
          analysis={analysis}
          explainedAnnotationId={explainedAnnotationId}
          deletingAnnotationId={deletingAnnotationId}
          onExplainSelection={onExplainSelection}
          onDeleteAnnotation={onDeleteAnnotation}
        />
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
        />
      </Stack>
    </ReaderPanel>
  );
}

function SideRailTabScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollArea h={sideRailPanelHeight} type="auto">
      <Box pr={4} pt="sm">
        {children}
      </Box>
    </ScrollArea>
  );
}

function BookSideRail({
  activeTab,
  selectionDraft,
  navigationItems,
  bookmarks,
  readerUnavailable,
  isAddingBookmark,
  isRelinking,
  preferences,
  decks,
  selectedDeckId,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
  annotations,
  isFetching,
  deletingBookmarkId,
  deletingAnnotationId,
  selectedAnnotationIds,
  canImportSelected,
  isImportingSelected,
  importableAnnotationIds,
  allImportableSelected,
  importStatusByAnnotationId,
  setPreferences,
  onActiveTabChange,
  onAddBookmark,
  onDeckChange,
  onExplainSelection,
  onJumpToLocator,
  onRelink,
  onDeleteBookmark,
  onToggleAnnotationSelection,
  onImportSelected,
  onToggleSelectAll,
  onDeleteAnnotation,
}: {
  activeTab: ReaderBookInspectorTab;
  selectionDraft: ReaderSelectionDraft | null;
  navigationItems: EpubNavigationItem[];
  bookmarks: ReaderBookBookmarkView[];
  readerUnavailable: boolean;
  isAddingBookmark: boolean;
  isRelinking: boolean;
  preferences: EpubReadingPreferences;
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
  annotations: ReaderArticleHighlight[];
  isFetching: boolean;
  deletingBookmarkId: number | null;
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
  onActiveTabChange: (tab: ReaderBookInspectorTab) => void;
  onAddBookmark: () => void;
  onDeckChange: (deckId: string | null) => void;
  onExplainSelection: () => void;
  onJumpToLocator: (locator: EpubBookLocator) => void;
  onRelink: () => void;
  onDeleteBookmark: (bookmarkId: number) => void;
  onToggleAnnotationSelection: (
    annotationId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
  onDeleteAnnotation: (annotationId: number) => void;
}) {
  return (
    <Stack gap="sm" style={sideRailStyle}>
      <Tabs
        value={activeTab}
        onChange={(value) => {
          if (isReaderBookInspectorTab(value)) {
            onActiveTabChange(value);
          }
        }}
        keepMounted={false}
      >
        <Tabs.List grow>
          <Tabs.Tab value="highlights">Highlights</Tabs.Tab>
          <Tabs.Tab value="bookmarks">Bookmarks</Tabs.Tab>
          <Tabs.Tab value="contents">Contents</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="highlights">
          <SideRailTabScroll>
            <HighlightsPanel
              selectionDraft={selectionDraft}
              decks={decks}
              selectedDeckId={selectedDeckId}
              isExplaining={isExplaining}
              streamError={streamError}
              analysis={analysis}
              explainedAnnotationId={explainedAnnotationId}
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
              onExplainSelection={onExplainSelection}
              onToggleAnnotationSelection={onToggleAnnotationSelection}
              onImportSelected={onImportSelected}
              onToggleSelectAll={onToggleSelectAll}
              onDeleteAnnotation={onDeleteAnnotation}
            />
          </SideRailTabScroll>
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks">
          <SideRailTabScroll>
            <BookmarksPanel
              bookmarks={bookmarks}
              readerUnavailable={readerUnavailable}
              isAddingBookmark={isAddingBookmark}
              deletingBookmarkId={deletingBookmarkId}
              onAddBookmark={onAddBookmark}
              onJumpToLocator={onJumpToLocator}
              onDeleteBookmark={onDeleteBookmark}
            />
          </SideRailTabScroll>
        </Tabs.Panel>
        <Tabs.Panel value="contents">
          <Box
            pr={4}
            pt="sm"
            style={{ height: sideRailPanelHeight, minHeight: 0 }}
          >
            <ContentsPanel
              items={navigationItems}
              isRelinking={isRelinking}
              preferences={preferences}
              setPreferences={setPreferences}
              onJumpToLocator={onJumpToLocator}
              onRelink={onRelink}
            />
          </Box>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function ReaderBookWorkspace({
  book,
  currentSpineItem,
  sectionIndex,
  sectionCount,
  readerUnavailable,
  loadState,
  loadError,
  renderedSection,
  iframeRef,
  isAddingBookmark,
  isRelinking,
  decks,
  selectedDeckId,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
  deletingAnnotationId,
  bookmarks,
  preferences,
  annotations,
  isFetching,
  deletingBookmarkId,
  selectedAnnotationIds,
  canImportSelected,
  isImportingSelected,
  importableAnnotationIds,
  allImportableSelected,
  importStatusByAnnotationId,
  activeInspectorTab,
  selectionDraft,
  setPreferences,
  onActiveInspectorTabChange,
  onAddBookmark,
  onSectionChange,
  onRelink,
  onRequestPermission,
  onIframeLoad,
  onDeckChange,
  onExplainSelection,
  onDeleteAnnotation,
  onJumpToLocator,
  onDeleteBookmark,
  onToggleAnnotationSelection,
  onImportSelected,
  onToggleSelectAll,
}: {
  book: ReaderBookHeaderData & { navigationJson: EpubNavigationItem[] };
  currentSpineItem: EpubSpineItem | null;
  sectionIndex: number;
  sectionCount: number;
  readerUnavailable: boolean;
  loadState: BookLoadState;
  loadError: string;
  renderedSection: RenderedSectionState | null;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  isAddingBookmark: boolean;
  isRelinking: boolean;
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
  deletingAnnotationId: number | null;
  bookmarks: ReaderBookBookmarkView[];
  preferences: EpubReadingPreferences;
  annotations: ReaderArticleHighlight[];
  isFetching: boolean;
  deletingBookmarkId: number | null;
  selectedAnnotationIds: number[];
  canImportSelected: boolean;
  isImportingSelected: boolean;
  importableAnnotationIds: number[];
  allImportableSelected: boolean;
  importStatusByAnnotationId: Record<number, HighlightImportResultStatus>;
  activeInspectorTab: ReaderBookInspectorTab;
  selectionDraft: ReaderSelectionDraft | null;
  setPreferences: React.Dispatch<
    React.SetStateAction<EpubReadingPreferences>
  >;
  onActiveInspectorTabChange: (tab: ReaderBookInspectorTab) => void;
  onAddBookmark: () => void;
  onSectionChange: (nextIndex: number) => void;
  onRelink: () => void;
  onRequestPermission: () => void;
  onIframeLoad: () => void;
  onDeckChange: (deckId: string | null) => void;
  onExplainSelection: () => void;
  onDeleteAnnotation: (annotationId: number) => void;
  onJumpToLocator: (locator: EpubBookLocator) => void;
  onDeleteBookmark: (bookmarkId: number) => void;
  onToggleAnnotationSelection: (
    annotationId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
}) {
  return (
    <Box style={bookWorkspaceResponsiveStyle}>
      <Stack gap="sm" style={{ minWidth: 0 }}>
        <BookReaderPanel
          currentSpineItem={currentSpineItem}
          sectionIndex={sectionIndex}
          sectionCount={sectionCount}
          readerUnavailable={readerUnavailable}
          loadState={loadState}
          loadError={loadError}
          title={book.title}
          renderedSection={renderedSection}
          iframeRef={iframeRef}
          isRelinking={isRelinking}
          onSectionChange={onSectionChange}
          onRelink={onRelink}
          onRequestPermission={onRequestPermission}
          onIframeLoad={onIframeLoad}
        />
      </Stack>

      <BookSideRail
        activeTab={activeInspectorTab}
        selectionDraft={selectionDraft}
        navigationItems={book.navigationJson}
        bookmarks={bookmarks}
        readerUnavailable={readerUnavailable}
        isAddingBookmark={isAddingBookmark}
        isRelinking={isRelinking}
        preferences={preferences}
        decks={decks}
        selectedDeckId={selectedDeckId}
        isExplaining={isExplaining}
        streamError={streamError}
        analysis={analysis}
        explainedAnnotationId={explainedAnnotationId}
        annotations={annotations}
        isFetching={isFetching}
        deletingBookmarkId={deletingBookmarkId}
        deletingAnnotationId={deletingAnnotationId}
        selectedAnnotationIds={selectedAnnotationIds}
        canImportSelected={canImportSelected}
        isImportingSelected={isImportingSelected}
        importableAnnotationIds={importableAnnotationIds}
        allImportableSelected={allImportableSelected}
        importStatusByAnnotationId={importStatusByAnnotationId}
        setPreferences={setPreferences}
        onActiveTabChange={onActiveInspectorTabChange}
        onAddBookmark={onAddBookmark}
        onDeckChange={onDeckChange}
        onExplainSelection={onExplainSelection}
        onJumpToLocator={onJumpToLocator}
        onRelink={onRelink}
        onDeleteBookmark={onDeleteBookmark}
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
  currentSpineItem,
  sectionIndex,
  sectionCount,
  readerUnavailable,
  loadState,
  loadError,
  renderedSection,
  iframeRef,
  isAddingBookmark,
  isRelinking,
  decks,
  selectedDeckId,
  isExplaining,
  streamError,
  analysis,
  explainedAnnotationId,
  deletingAnnotationId,
  bookmarks,
  preferences,
  annotations,
  isFetching,
  deletingBookmarkId,
  selectedAnnotationIds,
  canImportSelected,
  isImportingSelected,
  importableAnnotationIds,
  allImportableSelected,
  importStatusByAnnotationId,
  activeInspectorTab,
  selectionDraft,
  setPreferences,
  onActiveInspectorTabChange,
  onAddBookmark,
  onSectionChange,
  onRelink,
  onRequestPermission,
  onIframeLoad,
  onDeckChange,
  onDeleteAnnotation,
  onJumpToLocator,
  onDeleteBookmark,
  onToggleAnnotationSelection,
  onImportSelected,
  onToggleSelectAll,
  onExplainSelection,
}: {
  book: ReaderBookHeaderData & { navigationJson: EpubNavigationItem[] };
  currentSpineItem: EpubSpineItem | null;
  sectionIndex: number;
  sectionCount: number;
  readerUnavailable: boolean;
  loadState: BookLoadState;
  loadError: string;
  renderedSection: RenderedSectionState | null;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  isAddingBookmark: boolean;
  isRelinking: boolean;
  decks: ReaderDeckOption[];
  selectedDeckId: string | null;
  isExplaining: boolean;
  streamError: string;
  analysis: ReaderHighlightAnalysis | null;
  explainedAnnotationId: number | null;
  deletingAnnotationId: number | null;
  bookmarks: ReaderBookBookmarkView[];
  preferences: EpubReadingPreferences;
  annotations: ReaderArticleHighlight[];
  isFetching: boolean;
  deletingBookmarkId: number | null;
  selectedAnnotationIds: number[];
  canImportSelected: boolean;
  isImportingSelected: boolean;
  importableAnnotationIds: number[];
  allImportableSelected: boolean;
  importStatusByAnnotationId: Record<number, HighlightImportResultStatus>;
  activeInspectorTab: ReaderBookInspectorTab;
  selectionDraft: ReaderSelectionDraft | null;
  setPreferences: React.Dispatch<
    React.SetStateAction<EpubReadingPreferences>
  >;
  onActiveInspectorTabChange: (tab: ReaderBookInspectorTab) => void;
  onAddBookmark: () => void;
  onSectionChange: (nextIndex: number) => void;
  onRelink: () => void;
  onRequestPermission: () => void;
  onIframeLoad: () => void;
  onDeckChange: (deckId: string | null) => void;
  onDeleteAnnotation: (annotationId: number) => void;
  onJumpToLocator: (locator: EpubBookLocator) => void;
  onDeleteBookmark: (bookmarkId: number) => void;
  onToggleAnnotationSelection: (
    annotationId: number,
    isSelected: boolean,
  ) => void;
  onImportSelected: () => void;
  onToggleSelectAll: () => void;
  onExplainSelection: () => void;
}) {
  return (
    <Box style={readerPageStyle}>
      <Stack gap="sm">
        <ReaderBookHeader book={book} />
        <ReaderBookWorkspace
          book={book}
          currentSpineItem={currentSpineItem}
          sectionIndex={sectionIndex}
          sectionCount={sectionCount}
          readerUnavailable={readerUnavailable}
          loadState={loadState}
          loadError={loadError}
          renderedSection={renderedSection}
          iframeRef={iframeRef}
          isAddingBookmark={isAddingBookmark}
          isRelinking={isRelinking}
          decks={decks}
          selectedDeckId={selectedDeckId}
          isExplaining={isExplaining}
          streamError={streamError}
          analysis={analysis}
          explainedAnnotationId={explainedAnnotationId}
          deletingAnnotationId={deletingAnnotationId}
          bookmarks={bookmarks}
          preferences={preferences}
          annotations={annotations}
          isFetching={isFetching}
          deletingBookmarkId={deletingBookmarkId}
          selectedAnnotationIds={selectedAnnotationIds}
          canImportSelected={canImportSelected}
          isImportingSelected={isImportingSelected}
          importableAnnotationIds={importableAnnotationIds}
          allImportableSelected={allImportableSelected}
          importStatusByAnnotationId={importStatusByAnnotationId}
          activeInspectorTab={activeInspectorTab}
          selectionDraft={selectionDraft}
          setPreferences={setPreferences}
          onActiveInspectorTabChange={onActiveInspectorTabChange}
          onAddBookmark={onAddBookmark}
          onSectionChange={onSectionChange}
          onRelink={onRelink}
          onRequestPermission={onRequestPermission}
          onIframeLoad={onIframeLoad}
          onDeckChange={onDeckChange}
          onDeleteAnnotation={onDeleteAnnotation}
          onJumpToLocator={onJumpToLocator}
          onDeleteBookmark={onDeleteBookmark}
          onToggleAnnotationSelection={onToggleAnnotationSelection}
          onImportSelected={onImportSelected}
          onToggleSelectAll={onToggleSelectAll}
          onExplainSelection={onExplainSelection}
        />
      </Stack>
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

export default function ReaderBookPage() {
  const router = useRouter();
  const publicId = readerPublicIdFromQuery(router.query.publicId);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingScrollLocatorRef = useRef<EpubBookLocator | null>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [session, setSession] = useState<EpubSession | null>(null);
  const [loadState, setLoadState] = useState<BookLoadState>("checking");
  const [loadError, setLoadError] = useState("");
  const [storedHandle, setStoredHandle] =
    useState<LocalBookHandleRecord | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [renderedSection, setRenderedSection] =
    useState<RenderedSectionState | null>(null);
  const [preferences, setPreferences] = useState<EpubReadingPreferences>(
    DEFAULT_PREFERENCES,
  );
  const [selectionDraft, setSelectionDraft] =
    useState<ReaderSelectionDraft | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] =
    useState<ReaderBookInspectorTab>("highlights");
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
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [deletingBookmarkId, setDeletingBookmarkId] = useState<
    number | null
  >(null);
  const [isRelinking, setIsRelinking] = useState(false);

  const bookQuery = trpc.getReaderBookRoute.useQuery(
    { publicId },
    {
      enabled: publicId.length > 0,
      refetchOnWindowFocus: false,
    },
  );
  const updateProgress = trpc.updateReaderBookProgressRoute.useMutation();
  const createBookmark = trpc.createReaderBookBookmarkRoute.useMutation();
  const deleteBookmark = trpc.deleteReaderBookBookmarkRoute.useMutation();
  const deleteAnnotation =
    trpc.deleteReaderBookAnnotationRoute.useMutation();
  const importAnnotations =
    trpc.importReaderBookAnnotationsToDeckRoute.useMutation();

  const book = bookQuery.data?.book;
  const annotations = useMemo(() => {
    return bookQuery.data?.annotations ?? [];
  }, [bookQuery.data]);
  const bookmarks = bookQuery.data?.bookmarks ?? [];
  const decks = useMemo(() => {
    return bookQuery.data?.decks ?? [];
  }, [bookQuery.data?.decks]);
  const spineJson = book?.spineJson ?? [];
  const currentSpineItem = spineJson[sectionIndex] ?? null;
  const currentSectionText = renderedSection?.text ?? "";

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

    const progression = currentProgressionFromFrame(
      iframeRef.current,
      preferences.flow,
    );
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
  }, [
    book,
    currentSpineItem,
    preferences.flow,
    sectionIndex,
    spineJson.length,
  ]);

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
      setSectionIndex(nextIndex);
      setSelectionDraft(null);
      setAnalysis(null);
      setStreamError("");
    },
    [spineJson],
  );

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
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

  const handleFrameSelection = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !renderedSection) {
      setSelectionDraft(null);
      return;
    }

    const nextDraft = buildSelectionDraftFromFrame({
      iframe,
      sectionText: renderedSection.text,
    });
    setSelectionDraft(nextDraft);
    if (nextDraft) {
      setActiveInspectorTab("highlights");
    }
  }, [renderedSection]);

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
      setSelectionDraft(null);
      setAnalysis(null);
      setStreamError("");
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
      if (
        preferences.flow === "paginated" &&
        pageFrameHorizontally(iframeRef.current, direction)
      ) {
        scheduleProgressSave();
        return;
      }

      const nextIndex = Math.max(
        0,
        Math.min(spineJson.length - 1, sectionIndex + direction),
      );
      if (nextIndex === sectionIndex) {
        return;
      }

      void handleSectionChange(nextIndex);
    },
    [
      handleSectionChange,
      loadState,
      preferences.flow,
      scheduleProgressSave,
      sectionIndex,
      spineJson.length,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleReaderKeyDown);
    return () => {
      window.removeEventListener("keydown", handleReaderKeyDown);
    };
  }, [handleReaderKeyDown]);

  const handleIframeLoad = useCallback(() => {
    const document = iframeRef.current?.contentDocument;
    if (!document) {
      return;
    }

    document.addEventListener("mouseup", handleFrameSelection);
    document.addEventListener("keyup", handleFrameSelection);
    document.addEventListener("keydown", handleReaderKeyDown);
    document.addEventListener("scroll", scheduleProgressSave, true);
    applyCurrentSectionHighlights();
    scrollFrameToProgression(
      iframeRef.current,
      pendingScrollLocatorRef.current,
      preferences.flow,
    );
    pendingScrollLocatorRef.current = null;
    scheduleProgressSave();
  }, [
    applyCurrentSectionHighlights,
    handleFrameSelection,
    handleReaderKeyDown,
    preferences.flow,
    scheduleProgressSave,
  ]);

  const handleExplainSelection = async () => {
    if (
      !book ||
      !canExplainSelection(selectionDraft, isExplaining) ||
      !currentSpineItem
    ) {
      return;
    }

    const locator = currentLocator();
    if (!locator) {
      return;
    }

    setIsExplaining(true);
    setActiveInspectorTab("highlights");
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
            selectedText: selectionDraft.selectedText,
            contextBefore: selectionDraft.contextBefore,
            contextAfter: selectionDraft.contextAfter,
            occurrenceHint: selectionDraft.occurrenceHint,
            sectionText: currentSectionText,
            locatorJson: locator,
            chapterTitle: locator.chapterTitle,
            progression: locator.totalProgression,
          }),
        },
      );

      if (!hasExplainSelectionStream(response)) {
        throw new Error(await response.text());
      }

      await readBookExplainStream(response, {
        onAnnotationId: (annotationId) => {
          setExplainedAnnotationId(annotationId);
          setSelectedAnnotationIds((current) =>
            Array.from(new Set([...current, annotationId])),
          );
        },
        onAnalysis: setAnalysis,
        onDone: () => {
          setIsExplaining(false);
          bookQuery.refetch();
        },
        onError: (message) => {
          setStreamError(message);
        },
      });
    } catch (error: unknown) {
      const message = resolveExplainSelectionErrorMessage(error, false);
      if (message) {
        setStreamError(message);
      }
    } finally {
      setIsExplaining(false);
      bookQuery.refetch();
    }
  };

  const handleAddBookmark = async () => {
    if (!book) {
      return;
    }

    const locator = currentLocator();
    if (!locator) {
      return;
    }

    setIsAddingBookmark(true);
    try {
      await createBookmark.mutateAsync({
        publicId: book.publicId,
        locatorJson: locator,
        chapterTitle: locator.chapterTitle,
        progression: locator.totalProgression,
      });
      notifications.show({
        title: "Bookmark saved",
        message: "Added to this book.",
        color: "green",
      });
      bookQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Bookmark failed",
        message: mutationErrorMessage(error, "Couldn't save bookmark."),
        color: "red",
      });
    } finally {
      setIsAddingBookmark(false);
    }
  };

  const handleDeleteBookmark = async (bookmarkId: number) => {
    if (!book) {
      return;
    }

    setDeletingBookmarkId(bookmarkId);
    try {
      await deleteBookmark.mutateAsync({
        publicId: book.publicId,
        bookmarkId,
      });
      bookQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Delete failed",
        message: mutationErrorMessage(error, "Couldn't delete bookmark."),
        color: "red",
      });
    } finally {
      setDeletingBookmarkId(null);
    }
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
      return;
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
      currentSpineItem={currentSpineItem}
      sectionIndex={sectionIndex}
      sectionCount={spineJson.length}
      readerUnavailable={readerUnavailable}
      loadState={loadState}
      loadError={loadError}
      renderedSection={renderedSection}
      iframeRef={iframeRef}
      isAddingBookmark={isAddingBookmark}
      isRelinking={isRelinking}
      decks={decks}
      selectedDeckId={selectedDeckId}
      isExplaining={isExplaining}
      streamError={streamError}
      analysis={analysis}
      explainedAnnotationId={explainedAnnotationId}
      deletingAnnotationId={deletingAnnotationId}
      bookmarks={bookmarks}
      preferences={preferences}
      annotations={annotations}
      isFetching={bookQuery.isFetching}
      deletingBookmarkId={deletingBookmarkId}
      selectedAnnotationIds={selectedAnnotationIds}
      canImportSelected={canImportSelected}
      isImportingSelected={isImportingSelected}
      importableAnnotationIds={importableAnnotationIds}
      allImportableSelected={allImportableSelected}
      importStatusByAnnotationId={importStatusByAnnotationId}
      activeInspectorTab={activeInspectorTab}
      selectionDraft={selectionDraft}
      setPreferences={setPreferences}
      onActiveInspectorTabChange={setActiveInspectorTab}
      onAddBookmark={handleAddBookmark}
      onSectionChange={handleSectionChange}
      onRelink={handleRelink}
      onRequestPermission={handleRequestPermission}
      onIframeLoad={handleIframeLoad}
      onDeckChange={setSelectedDeckId}
      onDeleteAnnotation={handleDeleteAnnotation}
      onJumpToLocator={jumpToLocator}
      onDeleteBookmark={handleDeleteBookmark}
      onToggleAnnotationSelection={handleToggleAnnotationSelection}
      onImportSelected={handleImportSelected}
      onToggleSelectAll={handleToggleSelectAll}
      onExplainSelection={handleExplainSelection}
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

  return { props: {} };
}
