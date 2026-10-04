import {
  Anchor,
  Box,
  Button,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyRenderedArticleHighlights,
  clearRenderedArticleHighlights,
} from "../article-highlight-dom";
import {
  buildSavedArticleHighlightRanges,
  type SavedArticleHighlightForRender,
} from "../article-highlight-ranges";
import {
  clearCompletedReaderSelection,
  commitCompletedReaderSelection,
  listenForCompletedArticleSelections,
} from "../article-selection";
import { locatorProgression, type ReaderBookLocator } from "../book";
import {
  findReaderBookSectionIndex,
  normalizeReaderBookHref,
} from "../book-location";
import type {
  ReaderHighlight,
  ReaderPreferences,
  ReaderSelectionDraft,
} from "../contracts";
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
  type LocalBookHandleRecord,
} from "../epub/local-library";
import {
  openEpubSession,
  readEpubManifest,
  type EpubSession,
} from "../epub/parser";
import { canRelinkReaderBook } from "../epub/relink";
import type { EpubNavigationItem, EpubSpineItem } from "../epub/types";
import {
  DEFAULT_READER_PREFERENCES,
  resolveReaderPreferences,
} from "../preferences";
import { trpc } from "@/koala/trpc-config";
import { ReaderPanel } from "./layout";
import { ReaderToolsRail } from "./reader-tools-rail";
import { ReadingPreferencesControls } from "./reading-preferences-controls";
import {
  readerDividerColor,
  readerHeadingColor,
  readerPanelBorderColor,
  readerSubtleBackgroundColor,
} from "./theme";
import { useReaderHighlightController } from "./use-reader-highlight-controller";
import { ReaderWorkspace } from "./workspace";

const SELECTION_CONTEXT_RADIUS = 60;

type BookLoadState =
  "checking" | "missing" | "permission" | "loading" | "ready" | "error";

type RenderedSection = {
  html: string;
  text: string;
  objectUrls: string[];
};

type ReaderBookData = {
  publicId: string;
  fingerprint: string;
  title: string;
  author: string;
  opfIdentifier: string;
  navigationJson: EpubNavigationItem[];
  spineJson: EpubSpineItem[];
  progress: {
    lastLocatorJson: ReaderBookLocator;
    furthestLocatorJson: ReaderBookLocator;
  } | null;
};

type ReaderBookPageProps = {
  initialPreferences: ReaderPreferences;
};

export function locatorForBookFrame(options: {
  iframe: HTMLIFrameElement | null;
  spine: EpubSpineItem[];
  sectionIndex: number;
}): ReaderBookLocator | null {
  const spineItem = options.spine[options.sectionIndex];
  if (!spineItem) {
    return null;
  }

  const document = options.iframe?.contentDocument;
  const scrollingElement = document?.scrollingElement;
  const maxScroll = scrollingElement
    ? scrollingElement.scrollHeight - scrollingElement.clientHeight
    : 0;
  const progression =
    scrollingElement && maxScroll > 0
      ? scrollingElement.scrollTop / maxScroll
      : 0;
  const totalProgression =
    options.spine.length > 0
      ? (options.sectionIndex + progression) / options.spine.length
      : 0;

  return {
    href: spineItem.href,
    title: spineItem.title,
    chapterTitle: spineItem.title,
    sectionIndex: options.sectionIndex,
    progression: Math.max(0, Math.min(1, progression)),
    totalProgression: Math.max(0, Math.min(1, totalProgression)),
  };
}

export function scrollBookFrameToLocator(
  iframe: HTMLIFrameElement | null,
  locator: ReaderBookLocator | null,
): void {
  const scrollingElement = iframe?.contentDocument?.scrollingElement;
  if (!scrollingElement || !locator) {
    return;
  }
  const maxScroll =
    scrollingElement.scrollHeight - scrollingElement.clientHeight;
  scrollingElement.scrollTop =
    maxScroll * Math.max(0, Math.min(1, locator.progression ?? 0));
}

function textOffsetBeforeRange(
  container: HTMLElement,
  range: Range,
): number {
  const preceding = range.cloneRange();
  preceding.selectNodeContents(container);
  preceding.setEnd(range.startContainer, range.startOffset);
  return preceding.toString().length;
}

function countOverlappingOccurrences(
  text: string,
  phrase: string,
): number {
  let count = 0;
  let cursor = 0;
  while (phrase && cursor <= text.length - phrase.length) {
    const next = text.indexOf(phrase, cursor);
    if (next < 0) {
      break;
    }
    count += 1;
    cursor = next + 1;
  }

  return count;
}

function activeBookSelection(iframe: HTMLIFrameElement): {
  body: HTMLElement;
  range: Range;
  selectedText: string;
} | null {
  const document = iframe.contentDocument;
  const selection = iframe.contentWindow?.getSelection();
  const body = document?.body;
  if (!body || !selection || selection.isCollapsed) {
    return null;
  }
  if (selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const selectionIsInsideBody =
    body.contains(range.startContainer) &&
    body.contains(range.endContainer);
  if (!selectionIsInsideBody) {
    return null;
  }

  return {
    body,
    range,
    selectedText: selection.toString().trim(),
  };
}

function buildBookSelectionDraft(options: {
  iframe: HTMLIFrameElement;
  sectionText: string;
  locator: ReaderBookLocator;
}): ReaderSelectionDraft | null {
  const selection = activeBookSelection(options.iframe);
  if (!selection) {
    return null;
  }
  const { body, range, selectedText } = selection;
  if (!selectedText || selectedText.length > 220) {
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
  const occurrenceHint = countOverlappingOccurrences(
    options.sectionText.slice(0, startOffset),
    selectedText,
  );

  return {
    selectedText,
    contextBefore,
    contextAfter,
    occurrenceHint,
    location: {
      kind: "book",
      locator: options.locator,
      chapterTitle:
        options.locator.chapterTitle ?? options.locator.title ?? "",
      progression: locatorProgression(options.locator),
    },
    sourceContext: {
      kind: "book",
      sectionText: options.sectionText,
    },
  };
}

function bookDraftFromHighlight(options: {
  highlight: ReaderHighlight;
  sectionText: string;
}): ReaderSelectionDraft | null {
  if (options.highlight.location.kind !== "book") {
    return null;
  }

  return {
    selectedText: options.highlight.selectedText,
    contextBefore: options.highlight.contextBefore,
    contextAfter: options.highlight.contextAfter,
    occurrenceHint: options.highlight.selectedOccurrenceIndex,
    location: options.highlight.location,
    sourceContext: {
      kind: "book",
      sectionText: options.sectionText,
    },
  };
}

function shouldIgnoreReaderKey(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
  );
}

function readerKeyDirection(event: KeyboardEvent): -1 | 0 | 1 {
  if (shouldIgnoreReaderKey(event.target)) {
    return 0;
  }
  if (
    event.key === "ArrowLeft" ||
    event.key === "PageUp" ||
    event.key === "k"
  ) {
    return -1;
  }
  if (
    event.key === "ArrowRight" ||
    event.key === "PageDown" ||
    event.key === "j"
  ) {
    return 1;
  }

  return 0;
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
        <Box key={`${item.href}-${item.label}`}>
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            onClick={() => onJump(item.href)}
            style={{ whiteSpace: "normal", height: "auto" }}
          >
            {item.label}
          </Button>
          {item.children.length > 0 ? (
            <Box pl="sm">
              <NavigationList items={item.children} onJump={onJump} />
            </Box>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

function BookInformationRail({
  book,
  sectionIndex,
  loadState,
  isRelinking,
  onSectionChange,
  onJump,
  onRelink,
}: {
  book: ReaderBookData;
  sectionIndex: number;
  loadState: BookLoadState;
  isRelinking: boolean;
  onSectionChange: (sectionIndex: number) => void;
  onJump: (locator: ReaderBookLocator) => void;
  onRelink: () => void;
}) {
  const section = book.spineJson[sectionIndex];
  const sectionCount = book.spineJson.length;
  const unavailable = loadState !== "ready";
  const furthest = Math.round(
    locatorProgression(book.progress?.furthestLocatorJson) * 100,
  );

  return (
    <ReaderPanel style={{ maxHeight: "calc(100svh - 80px)" }}>
      <Anchor component={Link} href="/reader" size="sm">
        Back to Reading
      </Anchor>
      <Stack gap={3}>
        <Text fw={700} c={readerHeadingColor}>
          {book.title}
        </Text>
        {book.author ? (
          <Text size="sm" c="dimmed">
            {book.author}
          </Text>
        ) : null}
        <Text size="xs" c="dimmed">
          Furthest {furthest}%
        </Text>
      </Stack>
      <Stack
        gap="xs"
        style={{
          borderTop: `1px solid ${readerDividerColor}`,
          paddingTop: 12,
        }}
      >
        <Text size="xs" c="dimmed">
          Section {sectionIndex + 1} / {sectionCount}
        </Text>
        <Text size="sm" fw={700}>
          {section?.title ?? `Section ${sectionIndex + 1}`}
        </Text>
        <Group grow>
          <Button
            size="compact-sm"
            variant="light"
            color="gray"
            disabled={unavailable || sectionIndex === 0}
            onClick={() => onSectionChange(sectionIndex - 1)}
          >
            Previous
          </Button>
          <Button
            size="compact-sm"
            variant="light"
            color="gray"
            disabled={unavailable || sectionIndex >= sectionCount - 1}
            onClick={() => onSectionChange(sectionIndex + 1)}
          >
            Next
          </Button>
        </Group>
      </Stack>
      <Group justify="space-between">
        <Text size="sm" fw={700}>
          Contents
        </Text>
        <Button
          variant="subtle"
          color="gray"
          size="compact-xs"
          loading={isRelinking}
          onClick={onRelink}
        >
          Relink
        </Button>
      </Group>
      <ScrollArea mah="min(45svh, 430px)" type="auto">
        <NavigationList
          items={book.navigationJson}
          onJump={(href) => onJump({ href, progression: 0 })}
        />
      </ScrollArea>
    </ReaderPanel>
  );
}

function BookStatusPanel({
  state,
  error,
  isRelinking,
  onRelink,
  onPermission,
}: {
  state: BookLoadState;
  error: string;
  isRelinking: boolean;
  onRelink: () => void;
  onPermission: () => void;
}) {
  if (state === "checking" || state === "loading") {
    return (
      <Group justify="center" h="100%">
        <Loader size="sm" />
        <Text c="dimmed">Opening book...</Text>
      </Group>
    );
  }
  if (state === "permission") {
    return (
      <Stack align="center" justify="center" h="100%">
        <Text c="dimmed">Permission needed.</Text>
        <Button onClick={onPermission}>Open local file</Button>
      </Stack>
    );
  }
  if (state === "missing") {
    return (
      <Stack align="center" justify="center" h="100%">
        <Text c="dimmed">Local file needed.</Text>
        <Button loading={isRelinking} onClick={onRelink}>
          Relink EPUB
        </Button>
      </Stack>
    );
  }

  return (
    <Stack align="center" justify="center" h="100%">
      <Text c="red">{error || "Could not open this book."}</Text>
      <Button loading={isRelinking} onClick={onRelink}>
        Relink EPUB
      </Button>
    </Stack>
  );
}

function BookSurface({
  iframeRef,
  book,
  loadState,
  loadError,
  renderedSection,
  isRelinking,
  onRelink,
  onPermission,
  onLoad,
}: {
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  book: ReaderBookData;
  loadState: BookLoadState;
  loadError: string;
  renderedSection: RenderedSection | null;
  isRelinking: boolean;
  onRelink: () => void;
  onPermission: () => void;
  onLoad: () => void;
}) {
  return (
    <Box
      style={{
        height: "calc(100svh - 105px)",
        minHeight: 480,
        border: `1px solid ${readerPanelBorderColor}`,
        borderRadius: 12,
        background: readerSubtleBackgroundColor,
        overflow: "hidden",
      }}
    >
      {loadState === "ready" && renderedSection ? (
        <iframe
          ref={iframeRef}
          title={book.title}
          sandbox="allow-same-origin"
          srcDoc={renderedSection.html}
          onLoad={onLoad}
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <BookStatusPanel
          state={loadState}
          error={loadError}
          isRelinking={isRelinking}
          onRelink={onRelink}
          onPermission={onPermission}
        />
      )}
    </Box>
  );
}

async function findStoredBookHandle(options: {
  publicId: string;
  fingerprint: string;
}): Promise<LocalBookHandleRecord | null> {
  return (
    (await getLocalBookHandleByPublicId(options.publicId)) ??
    (await getLocalBookHandleByFingerprint(options.fingerprint))
  );
}

function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

export function ReaderBookPage({
  initialPreferences,
}: ReaderBookPageProps) {
  const router = useRouter();
  const publicId =
    typeof router.query.publicId === "string" ? router.query.publicId : "";
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const preferencesTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const preferencesMountedRef = useRef(false);
  const pendingLocatorRef = useRef<ReaderBookLocator | null>(null);
  const [loadedFrameDocument, setLoadedFrameDocument] =
    useState<Document | null>(null);
  const [session, setSession] = useState<EpubSession | null>(null);
  const [storedHandle, setStoredHandle] =
    useState<LocalBookHandleRecord | null>(null);
  const [loadState, setLoadState] = useState<BookLoadState>("checking");
  const [loadError, setLoadError] = useState("");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [renderedSection, setRenderedSection] =
    useState<RenderedSection | null>(null);
  const [preferences, setPreferences] = useState(() => {
    return resolveReaderPreferences(
      initialPreferences ?? DEFAULT_READER_PREFERENCES,
    );
  });
  const [isRelinking, setIsRelinking] = useState(false);
  const bookQuery = trpc.getReaderBookRoute.useQuery(
    { publicId },
    {
      enabled: Boolean(publicId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const updateProgress = trpc.updateReaderBookProgressRoute.useMutation();
  const updatePreferences =
    trpc.updateReaderPreferencesRoute.useMutation();
  const book = bookQuery.data?.book as ReaderBookData | undefined;

  const jumpToHighlight = useCallback(
    (highlight: ReaderHighlight) => {
      if (!book || highlight.location.kind !== "book") {
        return;
      }
      pendingLocatorRef.current = highlight.location.locator;
      setSectionIndex(
        findReaderBookSectionIndex(
          book.spineJson,
          highlight.location.locator,
        ),
      );
    },
    [book],
  );
  const controller = useReaderHighlightController({
    resource: { kind: "book", publicId },
    enabled: Boolean(book),
    onNavigateToHighlight: jumpToHighlight,
  });

  const currentLocator = useCallback(() => {
    if (!book) {
      return null;
    }
    return locatorForBookFrame({
      iframe: iframeRef.current,
      spine: book.spineJson,
      sectionIndex,
    });
  }, [book, sectionIndex]);

  const saveProgress = useCallback(async () => {
    if (!book) {
      return;
    }
    const locator = currentLocator();
    if (!locator) {
      return;
    }
    await updateProgress.mutateAsync({
      publicId: book.publicId,
      lastLocatorJson: locator,
      furthestLocatorJson: locator,
    });
  }, [book, currentLocator, updateProgress]);

  const scheduleProgressSave = useCallback(() => {
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }
    progressTimeoutRef.current = setTimeout(() => {
      void saveProgress();
      progressTimeoutRef.current = null;
    }, 700);
  }, [saveProgress]);

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
      if (session) {
        void session.close();
      }
    };
  }, [session]);

  useEffect(() => {
    return () => {
      renderedSection?.objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [renderedSection]);

  useEffect(() => {
    if (!book) {
      return;
    }
    let cancelled = false;

    const openStoredBook = async () => {
      setLoadState("checking");
      setLoadError("");
      try {
        const record = await findStoredBookHandle({
          publicId: book.publicId,
          fingerprint: book.fingerprint,
        });
        if (cancelled) {
          return;
        }
        if (!record) {
          setLoadState("missing");
          setStoredHandle(null);
          return;
        }
        setStoredHandle(record);
        const permission = await queryLocalBookPermission(record.handle);
        if (permission === "denied" || permission === "prompt") {
          setLoadState("permission");
          return;
        }
        setLoadState("loading");
        const opened = await openEpubSession(
          await record.handle.getFile(),
        );
        if (cancelled) {
          await opened.close();
          return;
        }
        setSession((current) => {
          if (current) {
            void current.close();
          }
          return opened;
        });
        const locator = book.progress?.lastLocatorJson ?? null;
        pendingLocatorRef.current = locator;
        setSectionIndex(
          findReaderBookSectionIndex(book.spineJson, locator),
        );
        setLoadState("ready");
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(
            mutationErrorMessage(error, "Couldn't open this local file."),
          );
        }
      }
    };
    void openStoredBook();
    return () => {
      cancelled = true;
    };
  }, [book?.fingerprint, book?.publicId]);

  const currentSpineItem = book?.spineJson[sectionIndex] ?? null;
  useEffect(() => {
    if (!session || !currentSpineItem) {
      return;
    }
    let cancelled = false;
    const render = async () => {
      try {
        const section = await session.renderSection(
          currentSpineItem.href,
          preferences,
        );
        if (cancelled) {
          section.objectUrls.forEach(URL.revokeObjectURL);
          return;
        }
        setRenderedSection((current) => {
          current?.objectUrls.forEach(URL.revokeObjectURL);
          return section;
        });
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(
            mutationErrorMessage(error, "Couldn't render this section."),
          );
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [currentSpineItem, preferences, session]);

  useEffect(() => {
    if (!preferencesMountedRef.current) {
      preferencesMountedRef.current = true;
      return;
    }
    if (preferencesTimeoutRef.current) {
      clearTimeout(preferencesTimeoutRef.current);
    }
    preferencesTimeoutRef.current = setTimeout(() => {
      updatePreferences.mutate(preferences);
      preferencesTimeoutRef.current = null;
    }, 500);
    return () => {
      if (preferencesTimeoutRef.current) {
        clearTimeout(preferencesTimeoutRef.current);
      }
    };
  }, [preferences]);

  const sectionHighlights = useMemo(() => {
    if (!currentSpineItem) {
      return [];
    }
    return controller.highlights.filter((highlight) => {
      return (
        highlight.location.kind === "book" &&
        normalizeReaderBookHref(highlight.location.locator.href) ===
          normalizeReaderBookHref(currentSpineItem.href)
      );
    });
  }, [controller.highlights, currentSpineItem]);

  const applySectionHighlights = useCallback(() => {
    const body = iframeRef.current?.contentDocument?.body;
    if (!body) {
      return;
    }
    clearRenderedArticleHighlights(body);
    const highlights: SavedArticleHighlightForRender[] =
      sectionHighlights.map((highlight) => ({
        id: highlight.id,
        selectedText: highlight.selectedText,
        selectedOccurrenceIndex: highlight.selectedOccurrenceIndex,
        contextBefore: highlight.contextBefore,
        contextAfter: highlight.contextAfter,
      }));
    const optimistic = controller.optimisticHighlight;
    if (
      optimistic &&
      optimistic.draft.location.kind === "book" &&
      currentSpineItem &&
      normalizeReaderBookHref(optimistic.draft.location.locator.href) ===
        normalizeReaderBookHref(currentSpineItem.href)
    ) {
      highlights.unshift({
        id: optimistic.id,
        selectedText: optimistic.draft.selectedText,
        selectedOccurrenceIndex: optimistic.draft.occurrenceHint,
        contextBefore: optimistic.draft.contextBefore,
        contextAfter: optimistic.draft.contextAfter,
      });
    }
    applyRenderedArticleHighlights(
      body,
      buildSavedArticleHighlightRanges({
        articleText: body.textContent ?? "",
        highlights,
      }),
    );
  }, [
    controller.optimisticHighlight,
    currentSpineItem,
    sectionHighlights,
  ]);

  useEffect(() => {
    applySectionHighlights();
  }, [applySectionHighlights]);

  const handleFrameSelection = useCallback(() => {
    const locator = currentLocator();
    const iframe = iframeRef.current;
    if (!iframe || !renderedSection || !locator) {
      controller.selectDraft(null);
      return;
    }
    const draft = buildBookSelectionDraft({
      iframe,
      sectionText: renderedSection.text,
      locator,
    });
    commitCompletedReaderSelection({
      draft,
      clearSelection: () => {
        clearCompletedReaderSelection(
          iframe.contentWindow?.getSelection(),
        );
      },
      selectDraft: controller.selectDraft,
    });
  }, [controller.selectDraft, currentLocator, renderedSection]);

  const handleHighlightClick = useCallback(
    (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              "mark[data-reader-highlight='saved'][data-highlight-id]",
            )
          : null;
      const highlightId = Number(target?.dataset.highlightId);
      const highlight = controller.highlights.find(
        (item) => item.id === highlightId,
      );
      if (!highlight) {
        return;
      }
      event.preventDefault();
      iframeRef.current?.contentWindow?.getSelection()?.removeAllRanges();
      controller.activateHighlight(highlight, {
        retryDraft: renderedSection
          ? bookDraftFromHighlight({
              highlight,
              sectionText: renderedSection.text,
            })
          : null,
      });
    },
    [controller.activateHighlight, controller.highlights, renderedSection],
  );

  useEffect(() => {
    if (
      loadState !== "ready" ||
      !renderedSection ||
      !loadedFrameDocument ||
      iframeRef.current?.contentDocument !== loadedFrameDocument
    ) {
      return;
    }
    const stopListeningForSelection = listenForCompletedArticleSelections(
      loadedFrameDocument,
      handleFrameSelection,
    );
    loadedFrameDocument.addEventListener("click", handleHighlightClick);
    loadedFrameDocument.addEventListener(
      "scroll",
      scheduleProgressSave,
      true,
    );

    return () => {
      stopListeningForSelection();
      loadedFrameDocument.removeEventListener(
        "click",
        handleHighlightClick,
      );
      loadedFrameDocument.removeEventListener(
        "scroll",
        scheduleProgressSave,
        true,
      );
    };
  }, [
    handleFrameSelection,
    handleHighlightClick,
    loadedFrameDocument,
    loadState,
    renderedSection,
    scheduleProgressSave,
  ]);

  const handleIframeLoad = useCallback(() => {
    const document = iframeRef.current?.contentDocument;
    if (!document) {
      return;
    }
    setLoadedFrameDocument(document);
    applySectionHighlights();
    scrollBookFrameToLocator(iframeRef.current, pendingLocatorRef.current);
    pendingLocatorRef.current = null;
    scheduleProgressSave();
  }, [applySectionHighlights, scheduleProgressSave]);

  useEffect(() => {
    const active = controller.activeHighlight;
    if (
      !active ||
      controller.retryDraft ||
      !renderedSection ||
      active.location.kind !== "book" ||
      !currentSpineItem ||
      normalizeReaderBookHref(active.location.locator.href) !==
        normalizeReaderBookHref(currentSpineItem.href)
    ) {
      return;
    }
    controller.activateHighlight(active, {
      retryDraft: bookDraftFromHighlight({
        highlight: active,
        sectionText: renderedSection.text,
      }),
    });
  }, [
    controller.activeHighlight,
    controller.activateHighlight,
    controller.retryDraft,
    currentSpineItem,
    renderedSection,
  ]);

  const handleSectionChange = useCallback(
    (nextSection: number) => {
      if (!book) {
        return;
      }
      void saveProgress();
      setSectionIndex(
        Math.max(0, Math.min(book.spineJson.length - 1, nextSection)),
      );
      controller.selectDraft(null);
    },
    [book, controller.selectDraft, saveProgress],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const direction = readerKeyDirection(event);
      if (direction === 0 || loadState !== "ready") {
        return;
      }
      event.preventDefault();
      handleSectionChange(sectionIndex + direction);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [handleSectionChange, loadState, sectionIndex]);

  const handlePermission = async () => {
    if (!storedHandle) {
      return;
    }
    const granted = await ensureLocalBookPermission(storedHandle.handle);
    if (!granted) {
      return;
    }
    const opened = await openEpubSession(
      await storedHandle.handle.getFile(),
    );
    setSession((current) => {
      if (current) {
        void current.close();
      }
      return opened;
    });
    setLoadState("ready");
  };

  const handleRelink = async () => {
    if (!book || !isFileSystemAccessSupported()) {
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
      const record = await saveLocalBookHandle({
        fingerprint: book.fingerprint,
        serverPublicId: book.publicId,
        file: picked.file,
        handle: picked.handle,
      });
      if (coverDataUrl) {
        await saveLocalCoverCache({
          fingerprint: book.fingerprint,
          coverDataUrl,
        });
      }
      const opened = await openEpubSession(picked.file);
      setStoredHandle(record);
      setSession((current) => {
        if (current) {
          void current.close();
        }
        return opened;
      });
      setLoadState("ready");
      notifications.show({
        title: "Book linked",
        message: "Local file is ready.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Relink failed",
        message: mutationErrorMessage(error, "Couldn't link this file."),
        color: "red",
      });
    } finally {
      setIsRelinking(false);
    }
  };

  if (bookQuery.isError) {
    return (
      <ReaderPanel>
        <Text c="red">{bookQuery.error.message}</Text>
      </ReaderPanel>
    );
  }
  if (bookQuery.isLoading || !book) {
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );
  }

  const settings = (
    <ReadingPreferencesControls
      preferences={preferences}
      onChange={setPreferences}
    />
  );

  return (
    <>
      <Head>
        <title>{`${book.title} · Koala Cards`}</title>
      </Head>
      <style jsx global>{`
        mark[data-reader-highlight="saved"] {
          background: rgba(248, 205, 225, 0.62);
          border-radius: 0.22em;
          color: inherit;
          cursor: pointer;
        }
        @media (max-width: 840px) {
          .reader-workspace-surface > div {
            min-height: 62svh !important;
            height: 62svh !important;
          }
        }
      `}</style>
      <ReaderWorkspace
        navigation={
          <BookInformationRail
            book={book}
            sectionIndex={sectionIndex}
            loadState={loadState}
            isRelinking={isRelinking}
            onSectionChange={handleSectionChange}
            onJump={(locator) => {
              pendingLocatorRef.current = locator;
              handleSectionChange(
                findReaderBookSectionIndex(book.spineJson, locator),
              );
            }}
            onRelink={() => {
              void handleRelink();
            }}
          />
        }
        surface={
          <BookSurface
            iframeRef={iframeRef}
            book={book}
            loadState={loadState}
            loadError={loadError}
            renderedSection={renderedSection}
            isRelinking={isRelinking}
            onRelink={() => {
              void handleRelink();
            }}
            onPermission={() => {
              void handlePermission();
            }}
            onLoad={handleIframeLoad}
          />
        }
        tools={
          <ReaderPanel style={{ height: "100%" }}>
            <ReaderToolsRail
              controller={controller}
              settings={settings}
              onOpenHighlight={(highlight) => {
                const retryDraft =
                  highlight.location.kind === "book" &&
                  currentSpineItem &&
                  renderedSection &&
                  normalizeReaderBookHref(
                    highlight.location.locator.href,
                  ) === normalizeReaderBookHref(currentSpineItem.href)
                    ? bookDraftFromHighlight({
                        highlight,
                        sectionText: renderedSection.text,
                      })
                    : null;
                controller.activateHighlight(highlight, {
                  navigate: true,
                  retryDraft,
                });
              }}
            />
          </ReaderPanel>
        }
      />
    </>
  );
}
