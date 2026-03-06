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
  type ReaderArticleHighlight,
} from "@/koala/reader/ui/highlights";
import {
  formatReaderDateTime,
  readerBodyFont,
  readerDisplayFont,
} from "@/koala/reader/ui/theme";
import { trpc } from "@/koala/trpc-config";
import {
  Anchor,
  Box,
  Group,
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
  onChunk: (chunk: string) => void;
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
    return "This article is queued for processing.";
  }

  return "This article is currently being processed.";
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

function hasExpandedSelection(): boolean {
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  return selection.rangeCount > 0 && !selection.isCollapsed;
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

function shouldFillToolsBody(view: HighlightToolsView): boolean {
  return view === "helper";
}

function highlightMatchesDraft(
  highlight: ReaderArticleHighlight,
  draft: HelperDraft,
): boolean {
  if (highlight.selectedText !== draft.selectedText) {
    return false;
  }

  if (highlight.selectedOccurrenceIndex !== draft.occurrenceHint) {
    return false;
  }

  if (highlight.contextBefore !== draft.contextBefore) {
    return false;
  }

  return highlight.contextAfter === draft.contextAfter;
}

function findMatchingHighlightId(
  highlights: ReaderArticleHighlight[],
  draft: HelperDraft,
): number | null {
  const match = highlights.find((highlight) =>
    highlightMatchesDraft(highlight, draft),
  );

  if (!match) {
    return null;
  }

  return match.id;
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

      const payload = dataLines.join("\n");

      if (eventName === "done") {
        handlers.onDone();
        finished = true;
        break;
      }

      if (eventName === "error") {
        handlers.onError(payload || "Streaming failed.");
        continue;
      }

      if (payload.length > 0) {
        handlers.onChunk(payload);
      }
    }
  }

  if (!finished) {
    handlers.onDone();
  }
}

const readerArticleBodyStyle = {
  maxWidth: "90ch",
  margin: "0 auto",
  fontFamily: readerDisplayFont,
  lineHeight: 1.85,
  fontSize: "1.07rem",
  color: "#4f3342",
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
          Go back to Reader and add it again from your preferred source.
        </Text>
      </ReaderPanel>
    );
  }

  return (
    <ReaderPanel>
      <Text c="dimmed">{pendingMessage(status)}</Text>
      <Text size="sm" c="dimmed">
        This page refreshes every 8 seconds while processing.
      </Text>
    </ReaderPanel>
  );
}

type ReaderArticleBodyProps = {
  contentText: string;
  emptyMessage: string;
  skipHtml?: boolean;
  articleRef?: React.RefObject<HTMLElement>;
};

function ReaderArticleBody({
  contentText,
  emptyMessage,
  skipHtml = false,
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
      <article style={readerArticleBodyStyle} ref={articleRef}>
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
};

type HighlightToolsView = "helper" | "saved" | "info";

function parseHighlightToolsView(value: string): HighlightToolsView {
  if (value === "saved") {
    return "saved";
  }

  if (value === "info") {
    return "info";
  }

  return "helper";
}

type HighlightInfoCardProps = {
  createdAt: string;
  sourceUrl: string | null;
};

function HighlightInfoCard({
  createdAt,
  sourceUrl,
}: HighlightInfoCardProps) {
  return (
    <Stack gap="sm">
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
    </Stack>
  );
}

function OwnerHighlightTools({
  publicId,
  articleRef,
  createdAt,
  sourceUrl,
}: OwnerHighlightToolsProps) {
  const [selectionDraft, setSelectionDraft] =
    useState<ReaderSelectionDraft | null>(null);
  const [helperDraftOverride, setHelperDraftOverride] =
    useState<HelperDraft | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<
    number | null
  >(null);
  const [streamText, setStreamText] = useState("");
  const [streamError, setStreamError] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [deletingHighlightId, setDeletingHighlightId] = useState<
    number | null
  >(null);
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

  useEffect(() => {
    const updateSelection = () => {
      const articleElement = articleRef.current;
      if (!articleElement) {
        setSelectionDraft(null);
        setActiveHighlightId(null);
        return;
      }

      const next = buildSelectionDraft(articleElement);
      if (next) {
        setSelectionDraft(next);
        setHelperDraftOverride(null);
        setActiveHighlightId(null);
        return;
      }

      if (hasExpandedSelection()) {
        setSelectionDraft(null);
      }
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

  const deleteHighlight = async (highlightId: number) => {
    if (deletingHighlightId !== null) {
      return;
    }

    setDeletingHighlightId(highlightId);

    if (isExplaining && activeHighlightId === highlightId) {
      explainAbortRef.current?.abort();
      setIsExplaining(false);
    }

    try {
      await deleteHighlightMutation.mutateAsync({
        publicId,
        highlightId,
      });
      await highlightsQuery.refetch();

      if (activeHighlightId !== highlightId) {
        return;
      }

      setActiveHighlightId(null);
      setHelperDraftOverride(null);
      setStreamText("");
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

    setStreamText("");
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
        onChunk: (chunk) => {
          setStreamText((previous) => previous + chunk);
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

      setActiveHighlightId(matchedHighlightId);
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

      if (
        clickedHighlight.status === "ready" &&
        clickedHighlight.explanationMarkdown.trim().length > 0
      ) {
        setStreamText(clickedHighlight.explanationMarkdown);
      } else {
        setStreamText("");
      }

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
      { label: "Word Helper", value: "helper" },
      { label: `Saved (${highlights.length})`, value: "saved" },
      { label: "Info", value: "info" },
    ];
  }, [highlights.length]);

  const queryErrorMessage = highlightsQuery.error?.message ?? "";
  const fillToolsBody = shouldFillToolsBody(activeView);
  const canDeleteActiveHighlight = activeHighlightId !== null;
  const isDeletingActiveHighlight =
    activeHighlightId !== null &&
    deletingHighlightId === activeHighlightId;

  const deleteActiveHighlight = () => {
    if (activeHighlightId === null) {
      return;
    }

    void deleteHighlight(activeHighlightId);
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
                streamText={streamText}
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
                onDeleteHighlight={(highlightId) => {
                  void deleteHighlight(highlightId);
                }}
              />
            )}
            {activeView === "info" && (
              <HighlightInfoCard
                createdAt={createdAt}
                sourceUrl={sourceUrl}
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
        articleRef={articleRef}
      />
    );
  }

  return (
    <ReaderArticleBody
      contentText={rawText}
      emptyMessage="Text is unavailable."
      skipHtml
      articleRef={articleRef}
    />
  );
}

export default function PublicReaderArticlePage({
  article,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const markdownText = normalizeMarkdownText(article.contentText);
  const rawText = article.contentText;
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
  const articleBody = renderReadyArticleBody(
    article.inputKind,
    markdownText,
    rawText,
    article.title,
    article.viewerIsOwner ? articleRef : undefined,
  );
  const ownerTools = article.viewerIsOwner ? (
    <OwnerHighlightTools
      publicId={article.publicId}
      articleRef={articleRef}
      createdAt={article.createdAt}
      sourceUrl={article.normalizedUrl}
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
            background: linear-gradient(
              180deg,
              rgba(250, 201, 223, 0.9),
              rgba(244, 176, 205, 0.72)
            );
            border-radius: 0.26em;
            box-shadow: inset 0 -1px 0 rgba(177, 96, 134, 0.24);
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
            background: linear-gradient(
              180deg,
              rgba(247, 184, 211, 0.95),
              rgba(236, 160, 194, 0.85)
            );
            box-shadow: inset 0 -1px 0 rgba(164, 81, 120, 0.35);
          }
        `}</style>
        <Stack gap="clamp(10px, 1.6vw, 18px)">
          {!article.viewerIsOwner && <ArticleMetaRow article={article} />}
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
  };

  return {
    props: {
      article: payload,
    },
  };
}
