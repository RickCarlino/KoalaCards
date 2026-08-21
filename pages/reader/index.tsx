import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import {
  isFileSystemAccessSupported,
  listLocalBookAvailability,
  openEpubFileWithPicker,
  readLocalCoverCache,
  requestPersistentReaderStorage,
  removeLocalBookData,
  saveLocalBookHandle,
  saveLocalCoverCache,
  type LocalBookAvailability,
  type ReaderFileSystemFileHandle,
} from "@/koala/reader/epub/local-library";
import { readEpubManifest } from "@/koala/reader/epub/parser";
import { canRelinkReaderBook } from "@/koala/reader/epub/relink";
import type { ReaderBookLocator } from "@/koala/reader/book";
import type {
  ReaderArticleLibraryItem,
  ReaderBookLibraryItem,
  ReaderLibraryItem,
} from "@/koala/reader/contracts";
import {
  filterAndSortReaderDocuments,
  readerDocumentFilterCounts,
  type ReaderDocumentFilter,
} from "@/koala/reader/library";
import { useReaderDashboardControls } from "@/koala/reader/ui/dashboard/use-reader-dashboard-controls";
import type { ReaderArticleSummary } from "@/koala/reader/ui/dashboard/types";
import {
  formatReaderDateTime,
  readerPanelBorderColor,
  readerSurfaceBackgroundColor,
  readerSurfaceShadow,
  readerHeadingColor,
  readerIngestLabel,
  readerListRowStyle,
  readerSubtleBackgroundColor,
} from "@/koala/reader/ui/theme";
import { trpc } from "@/koala/trpc-config";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Image,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";

type AddSourceMode = "url" | "raw" | "epub";

const RAW_TEXT_LENGTH_LIMIT = 240000;
const RAW_TEXT_WARNING_THRESHOLD = 220000;

type ReaderBookSummary = {
  id: number;
  publicId: string;
  fingerprint: string;
  title: string;
  author: string;
  description: string;
  opfIdentifier: string;
  fileName: string;
  coverPath: string;
  progress: {
    lastLocatorJson: ReaderBookLocator;
    furthestLocatorJson: ReaderBookLocator;
    lastOpenedAt: Date | null;
    updatedAt: Date;
  } | null;
  annotationCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type ParsedLocalBook = {
  handle: ReaderFileSystemFileHandle;
  file: File;
};

const readerPageStyle: React.CSSProperties = {
  width: "100%",
  paddingInline: "clamp(10px, 2.2vw, 28px)",
  paddingTop: "clamp(10px, 1.5vw, 18px)",
  paddingBottom: "clamp(16px, 2.6vw, 30px)",
};

const readerHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const readerDashboardLayoutStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: "clamp(10px, 1.4vw, 16px)",
};

const readerAddColumnStyle: React.CSSProperties = {
  flex: "1 1 300px",
  minWidth: 0,
  maxWidth: 360,
};

const readerContentColumnStyle: React.CSSProperties = {
  flex: "2 1 560px",
  minWidth: 0,
};

const readerSurfaceStyle: React.CSSProperties = {
  borderRadius: 12,
  border: `1px solid ${readerPanelBorderColor}`,
  backgroundColor: readerSurfaceBackgroundColor,
  boxShadow: readerSurfaceShadow,
  padding: "10px 12px",
};

function parseAddSourceMode(value: string): AddSourceMode | null {
  if (value === "url" || value === "raw" || value === "epub") {
    return value;
  }

  return null;
}

function parseDocumentFilter(value: string): ReaderDocumentFilter | null {
  if (
    value === "all" ||
    value === "url" ||
    value === "text" ||
    value === "epub"
  ) {
    return value;
  }

  return null;
}

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function progressPercent(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 100;
  }

  return Math.round(value * 100);
}

function bookProgressLabel(book: ReaderBookLibraryItem): string {
  const progress = book.progress;
  if (!progress) {
    return "Not started";
  }

  const furthest = progressPercent(
    progress.furthestLocator.totalProgression ??
      progress.furthestLocator.progression,
  );
  const chapter =
    progress.locator.chapterTitle ?? progress.locator.title ?? "";

  if (chapter.trim().length === 0) {
    return `Furthest ${furthest}%`;
  }

  return `Last: ${chapter} · Furthest ${furthest}%`;
}

function toArticleLibraryItem(
  article: ReaderArticleSummary,
): ReaderArticleLibraryItem {
  return {
    kind: "article",
    publicId: article.publicId,
    title: article.title,
    description: article.description,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    lastReadAt: article.lastReadAt,
    highlightCount: article.highlightCount,
    sourceKind: article.inputKind === "raw" ? "text" : "url",
    sourceUrl: article.normalizedUrl,
    readAt: article.readAt,
    ingest: {
      status: article.ingestStatus,
      error: article.ingestError,
    },
  };
}

function toBookLibraryItem(
  book: ReaderBookSummary,
): ReaderBookLibraryItem {
  return {
    kind: "book",
    publicId: book.publicId,
    title: book.title,
    description: book.description,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    lastReadAt: book.progress?.lastOpenedAt ?? null,
    highlightCount: book.annotationCount,
    author: book.author,
    fingerprint: book.fingerprint,
    fileName: book.fileName,
    coverPath: book.coverPath,
    progress: book.progress
      ? {
          locator: book.progress.lastLocatorJson,
          furthestLocator: book.progress.furthestLocatorJson,
          lastOpenedAt: book.progress.lastOpenedAt,
        }
      : null,
  };
}

function bookAvailabilityLabel(
  availability: LocalBookAvailability | undefined,
): { label: string; color: "teal" | "yellow" | "gray" } {
  if (!availability?.hasHandle) {
    return { label: "Needs file", color: "gray" };
  }

  if (
    availability.permission === "granted" ||
    availability.permission === "unsupported"
  ) {
    return { label: "On this device", color: "teal" };
  }

  return { label: "Needs permission", color: "yellow" };
}

function ReaderShortcuts() {
  return (
    <Group gap="sm" wrap="wrap">
      <Anchor component={Link} href="/reader/instapaper" size="sm">
        Instapaper
      </Anchor>
    </Group>
  );
}

type UrlAddFormProps = {
  articleUrl: string;
  isSavingUrl: boolean;
  onArticleUrlChange: (value: string) => void;
  onSaveUrlSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function UrlAddForm({
  articleUrl,
  isSavingUrl,
  onArticleUrlChange,
  onSaveUrlSubmit,
}: UrlAddFormProps) {
  return (
    <form onSubmit={onSaveUrlSubmit}>
      <Group gap="xs" wrap="wrap" align="flex-end">
        <TextInput
          aria-label="Article URL"
          placeholder="https://example.com/article"
          value={articleUrl}
          onChange={(event) =>
            onArticleUrlChange(event.currentTarget.value)
          }
          required
          style={{ flex: "1 1 220px" }}
        />
        <Button
          type="submit"
          size="sm"
          color="pink"
          loading={isSavingUrl}
          style={{ minWidth: 94 }}
        >
          Add
        </Button>
      </Group>
    </form>
  );
}

type RawTextAddFormProps = {
  rawTitle: string;
  rawText: string;
  isSavingRaw: boolean;
  onRawTitleChange: (value: string) => void;
  onRawTextChange: (value: string) => void;
  onSaveRawTextSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function RawTextAddForm({
  rawTitle,
  rawText,
  isSavingRaw,
  onRawTitleChange,
  onRawTextChange,
  onSaveRawTextSubmit,
}: RawTextAddFormProps) {
  const rawTextLength = rawText.length;
  const rawTextTone =
    rawTextLength > RAW_TEXT_WARNING_THRESHOLD ? "orange" : "dimmed";

  return (
    <form onSubmit={onSaveRawTextSubmit}>
      <Stack gap="xs">
        <TextInput
          aria-label="Optional title"
          placeholder="Title (optional)"
          value={rawTitle}
          onChange={(event) => onRawTitleChange(event.currentTarget.value)}
          maxLength={400}
        />
        <Textarea
          aria-label="Raw text"
          placeholder="Paste Korean text..."
          autosize
          minRows={8}
          maxRows={16}
          value={rawText}
          onChange={(event) => onRawTextChange(event.currentTarget.value)}
          required
        />
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="xs" c={rawTextTone}>
            {rawTextLength.toLocaleString()} /{" "}
            {RAW_TEXT_LENGTH_LIMIT.toLocaleString()}
          </Text>
          <Button
            type="submit"
            size="sm"
            color="pink"
            loading={isSavingRaw}
            style={{ minWidth: 94 }}
          >
            Add
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

type BookAddFormProps = {
  isOpeningBook: boolean;
  onOpenBook: () => void;
};

function BookAddForm({ isOpeningBook, onOpenBook }: BookAddFormProps) {
  return (
    <Stack gap="xs">
      <Button
        size="sm"
        color="pink"
        loading={isOpeningBook}
        onClick={onOpenBook}
        fullWidth
      >
        Open EPUB
      </Button>
    </Stack>
  );
}

type AddFromCardProps = {
  mode: AddSourceMode;
  onModeChange: (nextMode: AddSourceMode) => void;
  articleUrl: string;
  rawTitle: string;
  rawText: string;
  isSavingUrl: boolean;
  isSavingRaw: boolean;
  isOpeningBook: boolean;
  onArticleUrlChange: (value: string) => void;
  onRawTitleChange: (value: string) => void;
  onRawTextChange: (value: string) => void;
  onSaveUrlSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveRawTextSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onOpenBook: () => void;
};

function AddFromCard({
  mode,
  onModeChange,
  articleUrl,
  rawTitle,
  rawText,
  isSavingUrl,
  isSavingRaw,
  isOpeningBook,
  onArticleUrlChange,
  onRawTitleChange,
  onRawTextChange,
  onSaveUrlSubmit,
  onSaveRawTextSubmit,
  onOpenBook,
}: AddFromCardProps) {
  return (
    <Box style={readerSurfaceStyle}>
      <Stack gap="sm">
        <SegmentedControl
          value={mode}
          onChange={(nextMode) => {
            const parsedMode = parseAddSourceMode(nextMode);
            if (parsedMode) {
              onModeChange(parsedMode);
            }
          }}
          data={[
            { label: "URL", value: "url" },
            { label: "Text", value: "raw" },
            { label: "EPUB", value: "epub" },
          ]}
          radius="md"
          size="xs"
          color="pink"
          fullWidth
        />
        {mode === "url" && (
          <UrlAddForm
            articleUrl={articleUrl}
            isSavingUrl={isSavingUrl}
            onArticleUrlChange={onArticleUrlChange}
            onSaveUrlSubmit={onSaveUrlSubmit}
          />
        )}
        {mode === "raw" && (
          <RawTextAddForm
            rawTitle={rawTitle}
            rawText={rawText}
            isSavingRaw={isSavingRaw}
            onRawTitleChange={onRawTitleChange}
            onRawTextChange={onRawTextChange}
            onSaveRawTextSubmit={onSaveRawTextSubmit}
          />
        )}
        {mode === "epub" && (
          <BookAddForm
            isOpeningBook={isOpeningBook}
            onOpenBook={onOpenBook}
          />
        )}
      </Stack>
    </Box>
  );
}

type ArticleRowProps = {
  article: ReaderArticleLibraryItem;
  isDeleting: boolean;
  isUpdatingRead: boolean;
  onDelete: () => void;
  onToggleRead: () => void;
  withDivider: boolean;
};

function LibraryItemActions({ children }: { children: React.ReactNode }) {
  return (
    <Group gap={8} align="center" wrap="wrap">
      {children}
    </Group>
  );
}

function ArticleRow({
  article,
  isDeleting,
  isUpdatingRead,
  onDelete,
  onToggleRead,
  withDivider,
}: ArticleRowProps) {
  const isRead = article.readAt !== null;

  return (
    <Stack style={readerListRowStyle(withDivider)}>
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="xs"
      >
        <Stack gap={3} style={{ minWidth: 0, flex: "1 1 320px" }}>
          <Anchor
            component={Link}
            href={`/reader/${article.publicId}`}
            style={{
              fontWeight: 700,
              color: readerHeadingColor,
              lineHeight: 1.35,
            }}
          >
            {article.title}
          </Anchor>
          <Text size="xs" c="dimmed">
            {article.sourceKind === "url" ? "URL" : "Text"} ·{" "}
            {readerIngestLabel(article.ingest.status)} ·{" "}
            {formatReaderDateTime(article.createdAt)}
          </Text>
          {isRead && article.readAt && (
            <Text size="xs" c="dimmed">
              Read {formatReaderDateTime(article.readAt)}
            </Text>
          )}
          {article.ingest.status === "error" &&
            article.ingest.error.trim().length > 0 && (
              <Text size="sm" c="red" lineClamp={2}>
                {article.ingest.error}
              </Text>
            )}
          {article.description.trim().length > 0 && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {article.description}
            </Text>
          )}
        </Stack>
        <LibraryItemActions>
          <Button
            component={Link}
            href={`/reader/${article.publicId}`}
            variant="subtle"
            color="teal"
            size="compact-xs"
          >
            Open
          </Button>
          <Button
            variant="subtle"
            color={isRead ? "gray" : "teal"}
            size="compact-xs"
            loading={isUpdatingRead}
            onClick={onToggleRead}
          >
            {isRead ? "Mark unread" : "Mark read"}
          </Button>
          <Button
            variant="subtle"
            color="red"
            size="compact-xs"
            loading={isDeleting}
            onClick={onDelete}
          >
            Delete
          </Button>
        </LibraryItemActions>
      </Group>
    </Stack>
  );
}

type BookRowProps = {
  book: ReaderBookLibraryItem;
  availability: LocalBookAvailability | undefined;
  coverDataUrl: string | undefined;
  isRelinking: boolean;
  isDeleting: boolean;
  withDivider: boolean;
  onRelink: () => void;
  onDelete: () => void;
};

function BookRow({
  book,
  availability,
  coverDataUrl,
  isRelinking,
  isDeleting,
  withDivider,
  onRelink,
  onDelete,
}: BookRowProps) {
  const availabilityMeta = bookAvailabilityLabel(availability);

  return (
    <Stack style={readerListRowStyle(withDivider)}>
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="xs"
      >
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <Box
            style={{
              width: 42,
              height: 58,
              borderRadius: 6,
              border: `1px solid ${readerPanelBorderColor}`,
              backgroundColor: readerSubtleBackgroundColor,
              overflow: "hidden",
              flex: "0 0 auto",
            }}
          >
            {coverDataUrl ? (
              <Image
                src={coverDataUrl}
                alt=""
                width={42}
                height={58}
                fit="cover"
              />
            ) : null}
          </Box>
          <Stack gap={3} style={{ minWidth: 0, flex: "1 1 320px" }}>
            <Anchor
              component={Link}
              href={`/reader/books/${book.publicId}`}
              style={{
                fontWeight: 700,
                color: readerHeadingColor,
                lineHeight: 1.35,
              }}
            >
              {book.title}
            </Anchor>
            {book.author.trim().length > 0 && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {book.author}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              EPUB · {formatReaderDateTime(book.createdAt)}
            </Text>
            <Group gap={6} wrap="wrap">
              <Badge
                size="xs"
                variant="light"
                color={availabilityMeta.color}
              >
                {availabilityMeta.label}
              </Badge>
              <Text size="xs" c="dimmed">
                {bookProgressLabel(book)}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {book.highlightCount} highlights
            </Text>
          </Stack>
        </Group>
        <LibraryItemActions>
          <Button
            component={Link}
            href={`/reader/books/${book.publicId}`}
            variant="subtle"
            color="teal"
            size="compact-xs"
          >
            Open
          </Button>
          {!availability?.hasHandle && (
            <Button
              variant="subtle"
              color="pink"
              size="compact-xs"
              loading={isRelinking}
              onClick={onRelink}
            >
              Relink
            </Button>
          )}
          <Button
            variant="subtle"
            color="red"
            size="compact-xs"
            loading={isDeleting}
            onClick={onDelete}
          >
            Delete
          </Button>
        </LibraryItemActions>
      </Group>
    </Stack>
  );
}

function ReaderLibraryRow({
  item,
  withDivider,
  isDeleting,
  isUpdatingRead = false,
  isRelinking = false,
  availability,
  coverDataUrl,
  onDelete,
  onToggleRead,
  onRelink,
}: {
  item: ReaderLibraryItem;
  withDivider: boolean;
  isDeleting: boolean;
  isUpdatingRead?: boolean;
  isRelinking?: boolean;
  availability?: LocalBookAvailability;
  coverDataUrl?: string;
  onDelete: () => void;
  onToggleRead?: () => void;
  onRelink?: () => void;
}) {
  if (item.kind === "article") {
    return (
      <ArticleRow
        article={item}
        isDeleting={isDeleting}
        isUpdatingRead={isUpdatingRead}
        onDelete={onDelete}
        onToggleRead={() => onToggleRead?.()}
        withDivider={withDivider}
      />
    );
  }

  return (
    <BookRow
      book={item}
      availability={availability}
      coverDataUrl={coverDataUrl}
      isRelinking={isRelinking}
      isDeleting={isDeleting}
      withDivider={withDivider}
      onRelink={() => onRelink?.()}
      onDelete={onDelete}
    />
  );
}

type ReaderDocumentsProps = {
  documents: ReaderLibraryItem[];
  documentCount: number;
  filter: ReaderDocumentFilter;
  filterCounts: ReturnType<typeof readerDocumentFilterCounts>;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessages: string[];
  availabilityByFingerprint: Record<string, LocalBookAvailability>;
  coverByFingerprint: Record<string, string>;
  relinkingPublicId: string | null;
  deletingBookPublicId: string | null;
  deletingArticlePublicId: string | null;
  updatingReadPublicId: string | null;
  onFilterChange: (filter: ReaderDocumentFilter) => void;
  onRefresh: () => void;
  onDelete: (item: ReaderLibraryItem) => void;
  onToggleRead: (article: ReaderArticleLibraryItem) => void;
  onRelink: (book: ReaderBookLibraryItem) => void;
};

function ReaderDocuments({
  documents,
  documentCount,
  filter,
  filterCounts,
  isLoading,
  isRefreshing,
  errorMessages,
  availabilityByFingerprint,
  coverByFingerprint,
  relinkingPublicId,
  deletingBookPublicId,
  deletingArticlePublicId,
  updatingReadPublicId,
  onFilterChange,
  onRefresh,
  onDelete,
  onToggleRead,
  onRelink,
}: ReaderDocumentsProps) {
  let content: React.ReactNode = (
    <Text size="sm" c="dimmed">
      Loading documents…
    </Text>
  );
  if (!isLoading && documentCount === 0) {
    content = (
      <Text size="sm" c="dimmed">
        No documents yet.
      </Text>
    );
  }
  if (documentCount > 0) {
    content = (
      <Text size="sm" c="dimmed">
        No documents match this filter.
      </Text>
    );
  }
  if (documents.length > 0) {
    content = (
      <Stack gap={0}>
        {documents.map((item, index) => {
          const isBook = item.kind === "book";
          return (
            <ReaderLibraryRow
              key={`${item.kind}-${item.publicId}`}
              item={item}
              availability={
                isBook
                  ? availabilityByFingerprint[item.fingerprint]
                  : undefined
              }
              coverDataUrl={
                isBook ? coverByFingerprint[item.fingerprint] : undefined
              }
              isRelinking={isBook && relinkingPublicId === item.publicId}
              isDeleting={
                isBook
                  ? deletingBookPublicId === item.publicId
                  : deletingArticlePublicId === item.publicId
              }
              isUpdatingRead={
                !isBook && updatingReadPublicId === item.publicId
              }
              onRelink={() => {
                if (item.kind === "book") {
                  onRelink(item);
                }
              }}
              onToggleRead={() => {
                if (item.kind === "article") {
                  onToggleRead(item);
                }
              }}
              onDelete={() => onDelete(item)}
              withDivider={index > 0}
            />
          );
        })}
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm" fw={700} c={readerHeadingColor}>
          Documents
        </Text>
        <Group gap="xs" wrap="wrap" justify="flex-end">
          <Select
            aria-label="Filter documents"
            value={filter}
            onChange={(value) => {
              const nextFilter = parseDocumentFilter(value ?? "");
              if (nextFilter) {
                onFilterChange(nextFilter);
              }
            }}
            data={[
              {
                label: `All documents (${filterCounts.all})`,
                value: "all",
              },
              { label: `URL (${filterCounts.url})`, value: "url" },
              { label: `Text (${filterCounts.text})`, value: "text" },
              { label: `EPUB (${filterCounts.epub})`, value: "epub" },
            ]}
            size="xs"
            allowDeselect={false}
            w={190}
            maw="100%"
          />
          <Button
            variant="subtle"
            size="compact-sm"
            color="pink"
            loading={isRefreshing}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </Group>
      </Group>
      {errorMessages.map((errorMessage) => (
        <Text key={errorMessage} size="sm" c="red">
          {errorMessage}
        </Text>
      ))}
      {content}
    </Stack>
  );
}

export default function ReaderDashboardPage() {
  const controls = useReaderDashboardControls();
  const [addSourceMode, setAddSourceMode] = useState<AddSourceMode>("url");
  const [documentFilter, setDocumentFilter] =
    useState<ReaderDocumentFilter>("all");
  const router = useRouter();
  const [openingBook, setOpeningBook] = useState(false);
  const [relinkingPublicId, setRelinkingPublicId] = useState<
    string | null
  >(null);
  const [deletingBookPublicId, setDeletingBookPublicId] = useState<
    string | null
  >(null);
  const [availabilityByFingerprint, setAvailabilityByFingerprint] =
    useState<Record<string, LocalBookAvailability>>({});
  const [coverByFingerprint, setCoverByFingerprint] = useState<
    Record<string, string>
  >({});
  const bookQuery = trpc.listReaderBooksRoute.useQuery(
    { limit: 200 },
    { refetchOnWindowFocus: false },
  );
  const upsertBook = trpc.upsertReaderBookRoute.useMutation();
  const deleteBook = trpc.deleteReaderBookRoute.useMutation();
  const books = useMemo<ReaderBookSummary[]>(() => {
    return bookQuery.data?.books ?? [];
  }, [bookQuery.data]);
  const bookListErrorMessage = useMemo(() => {
    if (!bookQuery.isError) {
      return null;
    }

    return mutationErrorMessage(
      bookQuery.error,
      "Couldn't load EPUB documents.",
    );
  }, [bookQuery.error, bookQuery.isError]);
  const allDocuments = useMemo<ReaderLibraryItem[]>(() => {
    return [
      ...controls.allArticles.map(toArticleLibraryItem),
      ...books.map(toBookLibraryItem),
    ];
  }, [books, controls.allArticles]);
  const filterCounts = useMemo(() => {
    return readerDocumentFilterCounts(allDocuments);
  }, [allDocuments]);
  const documents = useMemo(() => {
    return filterAndSortReaderDocuments({
      items: allDocuments,
      filter: documentFilter,
    });
  }, [allDocuments, documentFilter]);
  const articleByPublicId = useMemo(() => {
    return new Map(
      controls.allArticles.map((article) => [article.publicId, article]),
    );
  }, [controls.allArticles]);
  const bookByPublicId = useMemo(() => {
    return new Map(books.map((book) => [book.publicId, book]));
  }, [books]);
  const documentErrorMessages = useMemo(() => {
    return [controls.listErrorMessage, bookListErrorMessage].filter(
      (message): message is string => message !== null,
    );
  }, [bookListErrorMessage, controls.listErrorMessage]);

  useEffect(() => {
    let cancelled = false;
    const fingerprints = books.map((book) => book.fingerprint);
    if (fingerprints.length === 0) {
      setAvailabilityByFingerprint({});
      setCoverByFingerprint({});
      return;
    }

    listLocalBookAvailability(fingerprints)
      .then((availability) => {
        if (!cancelled) {
          setAvailabilityByFingerprint(availability);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailabilityByFingerprint({});
        }
      });

    Promise.all(
      fingerprints.map(async (fingerprint) => {
        return [
          fingerprint,
          await readLocalCoverCache(fingerprint),
        ] as const;
      }),
    )
      .then((covers) => {
        if (cancelled) {
          return;
        }

        setCoverByFingerprint(
          Object.fromEntries(
            covers.filter((entry): entry is readonly [string, string] => {
              return entry[1] !== null;
            }),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCoverByFingerprint({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [books]);

  const saveParsedLocalBook = async (
    parsedLocalBook: ParsedLocalBook,
  ): Promise<string> => {
    await requestPersistentReaderStorage();
    const { manifest, coverDataUrl } = await readEpubManifest(
      parsedLocalBook.file,
    );
    const result = await upsertBook.mutateAsync({
      fingerprint: manifest.fingerprint,
      title: manifest.title,
      author: manifest.author,
      description: manifest.description,
      language: manifest.language,
      opfIdentifier: manifest.opfIdentifier,
      fileName: manifest.fileName,
      fileSize: manifest.fileSize,
      fileLastModified: manifest.fileLastModified,
      coverPath: manifest.coverPath,
      navigationJson: manifest.navigationJson,
      spineJson: manifest.spineJson,
    });

    await saveLocalBookHandle({
      fingerprint: manifest.fingerprint,
      serverPublicId: result.book.publicId,
      file: parsedLocalBook.file,
      handle: parsedLocalBook.handle,
    });
    if (coverDataUrl) {
      await saveLocalCoverCache({
        fingerprint: manifest.fingerprint,
        coverDataUrl,
      });
    }

    await bookQuery.refetch();
    return result.book.publicId;
  };

  const saveRelinkedLocalBook = async (
    book: ReaderBookSummary,
    parsedLocalBook: ParsedLocalBook,
  ): Promise<void> => {
    await requestPersistentReaderStorage();
    const { manifest, coverDataUrl } = await readEpubManifest(
      parsedLocalBook.file,
    );
    if (!canRelinkReaderBook({ book, manifest })) {
      throw new Error("Choose the same EPUB.");
    }

    await saveLocalBookHandle({
      fingerprint: book.fingerprint,
      serverPublicId: book.publicId,
      file: parsedLocalBook.file,
      handle: parsedLocalBook.handle,
    });
    if (coverDataUrl) {
      await saveLocalCoverCache({
        fingerprint: book.fingerprint,
        coverDataUrl,
      });
    }

    await bookQuery.refetch();
  };

  const pickLocalBook = async (): Promise<ParsedLocalBook | null> => {
    if (!isFileSystemAccessSupported()) {
      notifications.show({
        title: "Chrome required",
        message: "Open EPUB books in Chrome.",
        color: "red",
      });
      return null;
    }

    return openEpubFileWithPicker();
  };

  const handleOpenBook = async () => {
    setOpeningBook(true);

    try {
      const picked = await pickLocalBook();
      if (!picked) {
        return;
      }

      const publicId = await saveParsedLocalBook(picked);
      notifications.show({
        title: "Book added",
        message: "Saved to Reading.",
        color: "green",
      });
      router.push(`/reader/books/${publicId}`);
    } catch (error: unknown) {
      notifications.show({
        title: "Open failed",
        message: mutationErrorMessage(error, "Couldn't open this EPUB."),
        color: "red",
      });
    } finally {
      setOpeningBook(false);
    }
  };

  const handleRelinkBook = async (book: ReaderBookSummary) => {
    setRelinkingPublicId(book.publicId);

    try {
      const picked = await pickLocalBook();
      if (!picked) {
        return;
      }

      await saveRelinkedLocalBook(book, picked);
      notifications.show({
        title: "Book linked",
        message: "Local file is ready.",
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Relink failed",
        message: mutationErrorMessage(error, "Couldn't link this file."),
        color: "red",
      });
    } finally {
      setRelinkingPublicId((current) => {
        if (current === book.publicId) {
          return null;
        }

        return current;
      });
    }
  };

  const handleDeleteBook = async (book: ReaderBookSummary) => {
    const shouldDelete = window.confirm(`Delete "${book.title}"?`);
    if (!shouldDelete) {
      return;
    }

    setDeletingBookPublicId(book.publicId);
    try {
      await deleteBook.mutateAsync({ publicId: book.publicId });
      let localCleanupFailed = false;
      try {
        await removeLocalBookData(book.fingerprint);
      } catch {
        localCleanupFailed = true;
      }
      notifications.show({
        title: "Deleted",
        message: localCleanupFailed
          ? "Book removed. Local browser data could not be cleared."
          : "Book removed.",
        color: localCleanupFailed ? "yellow" : "green",
      });
      void bookQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Delete failed",
        message: mutationErrorMessage(error, "Couldn't delete this book."),
        color: "red",
      });
    } finally {
      setDeletingBookPublicId((current) => {
        return current === book.publicId ? null : current;
      });
    }
  };

  const refreshDocuments = async () => {
    await Promise.all([bookQuery.refetch(), controls.onRefreshArticles()]);
  };

  const deleteDocument = (item: ReaderLibraryItem) => {
    if (item.kind === "article") {
      const article = articleByPublicId.get(item.publicId);
      if (article) {
        void controls.onDeleteArticle(article);
      }
      return;
    }

    const book = bookByPublicId.get(item.publicId);
    if (book) {
      void handleDeleteBook(book);
    }
  };

  const toggleArticleReadState = (item: ReaderArticleLibraryItem) => {
    const article = articleByPublicId.get(item.publicId);
    if (article) {
      void controls.onToggleReadState(article);
    }
  };

  const relinkDocument = (item: ReaderBookLibraryItem) => {
    const book = bookByPublicId.get(item.publicId);
    if (book) {
      void handleRelinkBook(book);
    }
  };

  return (
    <Box style={readerPageStyle}>
      <Box style={readerHeaderRowStyle}>
        <Text size="xl" fw={700} c={readerHeadingColor}>
          Reading
        </Text>
      </Box>

      <Box style={readerDashboardLayoutStyle}>
        <Box style={readerAddColumnStyle}>
          <Stack gap="xs">
            <AddFromCard
              mode={addSourceMode}
              onModeChange={setAddSourceMode}
              articleUrl={controls.articleUrl}
              rawTitle={controls.rawTitle}
              rawText={controls.rawText}
              isSavingUrl={controls.isSavingUrl}
              isSavingRaw={controls.isSavingRaw}
              isOpeningBook={openingBook || upsertBook.isLoading}
              onArticleUrlChange={controls.onArticleUrlChange}
              onRawTitleChange={controls.onRawTitleChange}
              onRawTextChange={controls.onRawTextChange}
              onSaveUrlSubmit={controls.onSaveUrlSubmit}
              onSaveRawTextSubmit={controls.onSaveRawTextSubmit}
              onOpenBook={handleOpenBook}
            />
            <ReaderShortcuts />
          </Stack>
        </Box>

        <Box style={readerContentColumnStyle}>
          <Box style={readerSurfaceStyle}>
            <ReaderDocuments
              documents={documents}
              documentCount={allDocuments.length}
              filter={documentFilter}
              filterCounts={filterCounts}
              isLoading={bookQuery.isLoading || controls.isArticlesLoading}
              isRefreshing={
                bookQuery.isFetching || controls.isArticlesRefreshing
              }
              errorMessages={documentErrorMessages}
              availabilityByFingerprint={availabilityByFingerprint}
              coverByFingerprint={coverByFingerprint}
              relinkingPublicId={relinkingPublicId}
              deletingBookPublicId={deletingBookPublicId}
              deletingArticlePublicId={controls.deletingPublicId}
              updatingReadPublicId={controls.updatingReadPublicId}
              onFilterChange={setDocumentFilter}
              onRefresh={() => {
                void refreshDocuments();
              }}
              onDelete={deleteDocument}
              onToggleRead={toggleArticleReadState}
              onRelink={relinkDocument}
            />
          </Box>
        </Box>
      </Box>
    </Box>
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
