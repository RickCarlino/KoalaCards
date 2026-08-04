import { Anchor, Button, Group, Stack, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import Head from "next/head";
import Link from "next/link";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  applyRenderedArticleHighlights,
  clearRenderedArticleHighlights,
} from "../article-highlight-dom";
import { scrollToArticleHighlight } from "../article-location";
import {
  buildSavedArticleHighlightRanges,
  type SavedArticleHighlightForRender,
} from "../article-highlight-ranges";
import {
  clearCompletedReaderSelection,
  listenForCompletedArticleSelections,
} from "../article-selection";
import type {
  ReaderHighlight,
  ReaderPreferences,
  ReaderSelectionDraft,
} from "../contracts";
import {
  DEFAULT_READER_PREFERENCES,
  resolveReaderPreferences,
} from "../preferences";
import { trpc } from "@/koala/trpc-config";
import { ReaderPanel } from "./layout";
import { ReaderToolsRail } from "./reader-tools-rail";
import { ReadingPreferencesControls } from "./reading-preferences-controls";
import {
  formatReaderDateTime,
  readerDividerColor,
  readerFrameShadow,
  readerHeadingColor,
  readerPanelBorderColor,
  readerSubtleBackgroundColor,
} from "./theme";
import { useReaderHighlightController } from "./use-reader-highlight-controller";
import { ReaderWorkspace } from "./workspace";

const SELECTION_CONTEXT_RADIUS = 60;

export type ReaderArticlePageData = {
  publicId: string;
  title: string;
  normalizedUrl: string | null;
  inputKind: "url" | "raw";
  contentText: string;
  ingestStatus: "pending" | "in_progress" | "ready" | "error";
  ingestError: string;
  readAt: string | null;
  createdAt: string;
  viewerIsOwner: boolean;
  initialPreferences: ReaderPreferences;
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
  const trimmedLines = removeLeadingBlankLines(
    normalizeMarkdownText(contentText).split("\n"),
  );
  const normalizedTitle = normalizeComparableText(articleTitle);
  if (trimmedLines.length === 0 || !normalizedTitle) {
    return contentText;
  }

  const firstLine = trimmedLines[0].trim();
  const heading = firstLine.match(/^#{1,6}\s+(.+)$/)?.[1] ?? firstLine;
  if (normalizeComparableText(heading) !== normalizedTitle) {
    return contentText;
  }

  const startsWithUnderline =
    trimmedLines.length > 1 && /^[-=]{3,}$/.test(trimmedLines[1].trim());
  return removeLeadingBlankLines(
    trimmedLines.slice(startsWithUnderline ? 2 : 1),
  ).join("\n");
}

function contentLikelyHasCodeBlocks(value: string): boolean {
  return (
    value.includes("```") ||
    value.includes("~~~") ||
    /\n {4}\S/.test(value)
  );
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

function nodeInsideContainer(container: HTMLElement, node: Node): boolean {
  if (node === container) {
    return true;
  }
  const element =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element instanceof HTMLElement && container.contains(element);
}

function buildArticleSelectionDraft(
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
  const occurrenceHint = countOverlappingOccurrences(
    beforeText,
    selectedText,
  );

  return {
    selectedText,
    contextBefore: beforeText.slice(-SELECTION_CONTEXT_RADIUS),
    contextAfter: afterText.slice(0, SELECTION_CONTEXT_RADIUS),
    occurrenceHint,
    location: {
      kind: "article",
      occurrenceIndex: occurrenceHint,
    },
    sourceContext: { kind: "article" },
  };
}

function selectionDraftFromHighlight(
  highlight: ReaderHighlight,
): ReaderSelectionDraft {
  return {
    selectedText: highlight.selectedText,
    contextBefore: highlight.contextBefore,
    contextAfter: highlight.contextAfter,
    occurrenceHint: highlight.selectedOccurrenceIndex,
    location: {
      kind: "article",
      occurrenceIndex: highlight.selectedOccurrenceIndex,
    },
    sourceContext: { kind: "article" },
  };
}

function ArticleInformationRail({
  article,
  readAt,
  isUpdatingRead,
  onToggleRead,
}: {
  article: ReaderArticlePageData;
  readAt: string | null;
  isUpdatingRead: boolean;
  onToggleRead: () => void;
}) {
  return (
    <ReaderPanel>
      <Stack gap="sm">
        <Anchor component={Link} href="/reader" size="sm">
          Back to Reading
        </Anchor>
        <Text fw={700} c={readerHeadingColor}>
          {article.title}
        </Text>
        {article.normalizedUrl ? (
          <Anchor
            href={article.normalizedUrl}
            target="_blank"
            rel="noreferrer"
            size="sm"
          >
            <Group gap={5}>
              Source
              <IconExternalLink size={14} />
            </Group>
          </Anchor>
        ) : null}
        <Text size="xs" c="dimmed">
          Added {formatReaderDateTime(new Date(article.createdAt))}
        </Text>
        {article.viewerIsOwner ? (
          <Button
            variant="subtle"
            size="compact-sm"
            color={readAt ? "gray" : "teal"}
            loading={isUpdatingRead}
            onClick={onToggleRead}
          >
            {readAt ? "Mark unread" : "Mark read"}
          </Button>
        ) : null}
      </Stack>
    </ReaderPanel>
  );
}

function ArticleProcessingPanel({
  article,
}: {
  article: ReaderArticlePageData;
}) {
  if (article.ingestStatus === "error") {
    return (
      <ReaderPanel>
        <Text c="red">
          {article.ingestError || "This article could not be prepared."}
        </Text>
      </ReaderPanel>
    );
  }

  return (
    <ReaderPanel>
      <Text c="dimmed">
        {article.ingestStatus === "pending"
          ? "Waiting to prepare this article."
          : "Preparing this article."}
      </Text>
    </ReaderPanel>
  );
}

function ArticleSurface({
  article,
  articleRef,
  preferences,
  codeLineMode,
}: {
  article: ReaderArticlePageData;
  articleRef: React.RefObject<HTMLElement>;
  preferences: ReaderPreferences;
  codeLineMode: "scroll" | "wrap";
}) {
  const content =
    article.inputKind === "url"
      ? stripLeadingTitleFromMarkdown(article.contentText, article.title)
      : article.contentText;
  if (!content.trim()) {
    return (
      <ReaderPanel>
        <Text c="dimmed">Text is unavailable.</Text>
      </ReaderPanel>
    );
  }

  return (
    <ReaderPanel>
      <article
        ref={articleRef}
        data-reader-article="content"
        data-code-wrap={codeLineMode === "wrap" ? "on" : "off"}
        style={{
          maxWidth: preferences.readingWidth,
          margin: "0 auto",
          fontSize: preferences.fontSize,
          lineHeight: preferences.lineHeight,
          color: readerHeadingColor,
        }}
      >
        <ReactMarkdown
          skipHtml={article.inputKind === "raw"}
          remarkPlugins={[remarkGfm]}
        >
          {content}
        </ReactMarkdown>
      </article>
    </ReaderPanel>
  );
}

export function ReaderArticlePage({
  article,
}: {
  article: ReaderArticlePageData;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const selectionKeyRef = useRef("");
  const preferencesTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const preferencesMountedRef = useRef(false);
  const [preferences, setPreferences] = useState(() => {
    return resolveReaderPreferences(
      article.initialPreferences ?? DEFAULT_READER_PREFERENCES,
    );
  });
  const [codeLineMode, setCodeLineMode] = useState<"scroll" | "wrap">(
    "scroll",
  );
  const [readAt, setReadAt] = useState(article.readAt);
  const updatePreferences =
    trpc.updateReaderPreferencesRoute.useMutation();
  const updateReadState =
    trpc.setReaderArticleReadStateRoute.useMutation();
  const navigateToHighlight = useCallback((highlight: ReaderHighlight) => {
    scrollToArticleHighlight(articleRef.current, highlight.id);
  }, []);
  const controller = useReaderHighlightController({
    resource: { kind: "article", publicId: article.publicId },
    enabled: article.viewerIsOwner && article.ingestStatus === "ready",
    onNavigateToHighlight: navigateToHighlight,
  });

  useEffect(() => {
    if (
      article.ingestStatus !== "pending" &&
      article.ingestStatus !== "in_progress"
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      window.location.reload();
    }, 8000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [article.ingestStatus]);

  useEffect(() => {
    if (!article.viewerIsOwner) {
      return;
    }
    const updateSelection = () => {
      const element = articleRef.current;
      const draft = element ? buildArticleSelectionDraft(element) : null;
      if (draft) {
        clearCompletedReaderSelection(window.getSelection());
      }
      const key = draft
        ? JSON.stringify([
            draft.selectedText,
            draft.contextBefore,
            draft.contextAfter,
            draft.occurrenceHint,
          ])
        : "";
      if (key === selectionKeyRef.current) {
        return;
      }
      selectionKeyRef.current = key;
      controller.selectDraft(draft);
    };

    const element = articleRef.current;
    return element
      ? listenForCompletedArticleSelections(element, updateSelection)
      : undefined;
  }, [article.viewerIsOwner, controller.selectDraft]);

  const renderedHighlights = useMemo<
    SavedArticleHighlightForRender[]
  >(() => {
    const saved = controller.highlights.map((highlight) => ({
      id: highlight.id,
      selectedText: highlight.selectedText,
      selectedOccurrenceIndex: highlight.selectedOccurrenceIndex,
      contextBefore: highlight.contextBefore,
      contextAfter: highlight.contextAfter,
    }));
    const optimistic = controller.optimisticHighlight;
    if (!optimistic) {
      return saved;
    }

    return [
      {
        id: optimistic.id,
        selectedText: optimistic.draft.selectedText,
        selectedOccurrenceIndex: optimistic.draft.occurrenceHint,
        contextBefore: optimistic.draft.contextBefore,
        contextAfter: optimistic.draft.contextAfter,
      },
      ...saved.filter((highlight) => highlight.id !== optimistic.id),
    ];
  }, [controller.highlights, controller.optimisticHighlight]);

  useEffect(() => {
    const element = articleRef.current;
    if (!element) {
      return;
    }
    clearRenderedArticleHighlights(element);
    const ranges = buildSavedArticleHighlightRanges({
      articleText: element.textContent ?? "",
      highlights: renderedHighlights,
    });
    applyRenderedArticleHighlights(element, ranges);
  }, [renderedHighlights]);

  useEffect(() => {
    const element = articleRef.current;
    if (!element) {
      return;
    }
    const handleHighlightClick = (event: MouseEvent) => {
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
      window.getSelection()?.removeAllRanges();
      controller.activateHighlight(highlight, {
        retryDraft: selectionDraftFromHighlight(highlight),
      });
    };
    element.addEventListener("click", handleHighlightClick);
    return () => {
      element.removeEventListener("click", handleHighlightClick);
    };
  }, [controller.activateHighlight, controller.highlights]);

  useEffect(() => {
    if (!article.viewerIsOwner) {
      return;
    }
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
  }, [article.viewerIsOwner, preferences]);

  const handleToggleRead = async () => {
    const nextRead = readAt === null;
    const result = await updateReadState.mutateAsync({
      publicId: article.publicId,
      read: nextRead,
    });
    setReadAt(result.article.readAt?.toISOString() ?? null);
  };

  const settings = (
    <ReadingPreferencesControls
      preferences={preferences}
      onChange={setPreferences}
      codeLineMode={
        contentLikelyHasCodeBlocks(article.contentText)
          ? codeLineMode
          : undefined
      }
      onCodeLineModeChange={
        contentLikelyHasCodeBlocks(article.contentText)
          ? setCodeLineMode
          : undefined
      }
    />
  );
  const tools =
    article.viewerIsOwner && article.ingestStatus === "ready" ? (
      <ReaderPanel style={{ height: "100%" }}>
        <ReaderToolsRail
          controller={controller}
          settings={settings}
          onOpenHighlight={(highlight) => {
            controller.activateHighlight(highlight, {
              navigate: true,
              retryDraft: selectionDraftFromHighlight(highlight),
            });
          }}
        />
      </ReaderPanel>
    ) : null;
  const surface =
    article.ingestStatus === "ready" ? (
      <ArticleSurface
        article={article}
        articleRef={articleRef}
        preferences={preferences}
        codeLineMode={codeLineMode}
      />
    ) : (
      <ArticleProcessingPanel article={article} />
    );

  return (
    <>
      <Head>
        <title>{`${article.title} · Koala Cards`}</title>
      </Head>
      <style jsx global>{`
        article mark[data-reader-highlight="saved"] {
          background: rgba(248, 205, 225, 0.62);
          border-radius: 0.26em;
          color: inherit;
          cursor: pointer;
          padding: 0 0.08em;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
        article[data-reader-article="content"] pre {
          margin: 1.05rem 0;
          max-width: 100%;
          overflow-x: auto;
          padding: 0.92rem 1rem;
          border: 1px solid ${readerPanelBorderColor};
          border-radius: 14px;
          background: ${readerSubtleBackgroundColor};
          box-shadow: ${readerFrameShadow};
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
          padding: 0.1em 0.36em;
          border: 1px solid ${readerDividerColor};
          border-radius: 7px;
          background: rgba(253, 244, 250, 0.95);
        }
      `}</style>
      <ReaderWorkspace
        navigation={
          <ArticleInformationRail
            article={article}
            readAt={readAt}
            isUpdatingRead={updateReadState.isLoading}
            onToggleRead={() => {
              void handleToggleRead();
            }}
          />
        }
        surface={surface}
        tools={tools}
      />
    </>
  );
}
