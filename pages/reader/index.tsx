import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import {
  isFileSystemAccessSupported,
  listLocalBookAvailability,
  openEpubFileWithPicker,
  readLocalCoverCache,
  requestPersistentReaderStorage,
  saveLocalBookHandle,
  saveLocalCoverCache,
  saveLocalManifestCache,
  type LocalBookAvailability,
  type ReaderFileSystemFileHandle,
} from "@/koala/reader/epub/local-library";
import { readEpubManifest } from "@/koala/reader/epub/parser";
import {
  canRelinkReaderBook,
  manifestForRelinkedReaderBook,
} from "@/koala/reader/epub/relink";
import { useReaderDashboardControls } from "@/koala/reader/ui/dashboard/use-reader-dashboard-controls";
import type {
  ReaderArticleSummary,
  ReaderReadFilter,
} from "@/koala/reader/ui/dashboard/types";
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
  opfIdentifier: string;
  fileName: string;
  coverPath: string;
  progress: {
    lastLocatorJson: {
      title?: string;
      chapterTitle?: string;
      totalProgression?: number;
      progression?: number;
    };
    furthestLocatorJson: {
      totalProgression?: number;
      progression?: number;
    };
    lastOpenedAt: Date | null;
  } | null;
  bookmarkCount: number;
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

function parseReadFilter(value: string): ReaderReadFilter | null {
  if (value === "unread" || value === "read" || value === "all") {
    return value;
  }

  return null;
}

function filteredEmptyMessage(options: {
  hasAnyArticles: boolean;
  readFilter: ReaderReadFilter;
}): string {
  if (!options.hasAnyArticles) {
    return "No saved articles yet.";
  }

  if (options.readFilter === "unread") {
    return "No unread articles. Try Read or All.";
  }

  if (options.readFilter === "read") {
    return "No read articles yet.";
  }

  return "No matching articles.";
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

function bookProgressLabel(book: ReaderBookSummary): string {
  const progress = book.progress;
  if (!progress) {
    return "Not started";
  }

  const furthest = progressPercent(
    progress.furthestLocatorJson.totalProgression ??
      progress.furthestLocatorJson.progression,
  );
  const chapter =
    progress.lastLocatorJson.chapterTitle ??
    progress.lastLocatorJson.title ??
    "";

  if (chapter.trim().length === 0) {
    return `Furthest ${furthest}%`;
  }

  return `Last: ${chapter} · Furthest ${furthest}%`;
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

type ReaderShortcutsProps = {
  includeBookmarklet: boolean;
};

function ReaderShortcuts({ includeBookmarklet }: ReaderShortcutsProps) {
  return (
    <Group gap="sm" wrap="wrap">
      <Anchor component={Link} href="/reader/instapaper" size="sm">
        Instapaper
      </Anchor>
      {includeBookmarklet && (
        <Anchor component={Link} href="/reader/bookmarklet" size="sm">
          Bookmarklet
        </Anchor>
      )}
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
            { label: "Book", value: "epub" },
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
  article: ReaderArticleSummary;
  isDeleting: boolean;
  isUpdatingRead: boolean;
  onDelete: () => void;
  onToggleRead: () => void;
  withDivider: boolean;
};

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
            {readerIngestLabel(article.ingestStatus)} ·{" "}
            {formatReaderDateTime(article.createdAt)}
          </Text>
          {isRead && article.readAt && (
            <Text size="xs" c="dimmed">
              Read {formatReaderDateTime(article.readAt)}
            </Text>
          )}
          {article.ingestStatus === "error" &&
            article.ingestError.trim().length > 0 && (
              <Text size="sm" c="red" lineClamp={2}>
                {article.ingestError}
              </Text>
            )}
          {article.description.trim().length > 0 && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {article.description}
            </Text>
          )}
        </Stack>
        <Group gap={8} align="center" wrap="wrap">
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
        </Group>
      </Group>
    </Stack>
  );
}

type BookRowProps = {
  book: ReaderBookSummary;
  availability: LocalBookAvailability | undefined;
  coverDataUrl: string | undefined;
  isRelinking: boolean;
  withDivider: boolean;
  onRelink: () => void;
};

function BookRow({
  book,
  availability,
  coverDataUrl,
  isRelinking,
  withDivider,
  onRelink,
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
              {book.bookmarkCount} bookmarks · {book.annotationCount}{" "}
              highlights
            </Text>
          </Stack>
        </Group>
        <Group gap={8} align="center" wrap="wrap">
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
        </Group>
      </Group>
    </Stack>
  );
}

type BooksCardProps = {
  books: ReaderBookSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  availabilityByFingerprint: Record<string, LocalBookAvailability>;
  coverByFingerprint: Record<string, string>;
  relinkingPublicId: string | null;
  onRefresh: () => void;
  onRelinkBook: (book: ReaderBookSummary) => void;
};

function BooksCard({
  books,
  isLoading,
  isRefreshing,
  errorMessage,
  availabilityByFingerprint,
  coverByFingerprint,
  relinkingPublicId,
  onRefresh,
  onRelinkBook,
}: BooksCardProps) {
  return (
    <Box style={readerSurfaceStyle}>
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" fw={700} c={readerHeadingColor}>
            Books
          </Text>
          <Button
            variant="subtle"
            size="compact-sm"
            color="pink"
            onClick={onRefresh}
            loading={isRefreshing}
          >
            Refresh
          </Button>
        </Group>
        {isLoading && (
          <Text size="sm" c="dimmed">
            Loading books...
          </Text>
        )}
        {errorMessage && <Text c="red">{errorMessage}</Text>}
        {!isLoading && !errorMessage && books.length === 0 && (
          <Text size="sm" c="dimmed">
            No books yet.
          </Text>
        )}
        {!isLoading && !errorMessage && books.length > 0 && (
          <Stack gap={0}>
            {books.map((book, index) => (
              <BookRow
                key={book.id}
                book={book}
                availability={availabilityByFingerprint[book.fingerprint]}
                coverDataUrl={coverByFingerprint[book.fingerprint]}
                isRelinking={relinkingPublicId === book.publicId}
                onRelink={() => onRelinkBook(book)}
                withDivider={index > 0}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

type ArticlesBodyProps = {
  isLoading: boolean;
  errorMessage: string | null;
  readFilter: ReaderReadFilter;
  articles: ReaderArticleSummary[];
  hasAnyArticles: boolean;
  deletingPublicId: string | null;
  updatingReadPublicId: string | null;
  onDeleteArticle: (article: ReaderArticleSummary) => void;
  onToggleReadState: (article: ReaderArticleSummary) => void;
};

function ArticlesBody({
  isLoading,
  errorMessage,
  readFilter,
  articles,
  hasAnyArticles,
  deletingPublicId,
  updatingReadPublicId,
  onDeleteArticle,
  onToggleReadState,
}: ArticlesBodyProps) {
  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading articles...
      </Text>
    );
  }

  if (errorMessage) {
    return <Text c="red">{errorMessage}</Text>;
  }

  if (articles.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {filteredEmptyMessage({ hasAnyArticles, readFilter })}
      </Text>
    );
  }

  return (
    <Stack gap={0}>
      {articles.map((article, index) => {
        return (
          <ArticleRow
            key={article.id}
            article={article}
            isDeleting={deletingPublicId === article.publicId}
            isUpdatingRead={updatingReadPublicId === article.publicId}
            onDelete={() => onDeleteArticle(article)}
            onToggleRead={() => onToggleReadState(article)}
            withDivider={index > 0}
          />
        );
      })}
    </Stack>
  );
}

type ArticlesCardProps = {
  articles: ReaderArticleSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  readFilter: ReaderReadFilter;
  allArticlesCount: number;
  readArticlesCount: number;
  unreadArticlesCount: number;
  deletingPublicId: string | null;
  updatingReadPublicId: string | null;
  onReadFilterChange: (next: ReaderReadFilter) => void;
  onDeleteArticle: (article: ReaderArticleSummary) => void;
  onToggleReadState: (article: ReaderArticleSummary) => void;
  onRefresh: () => void;
};

function ArticlesCard({
  articles,
  isLoading,
  isRefreshing,
  errorMessage,
  readFilter,
  allArticlesCount,
  readArticlesCount,
  unreadArticlesCount,
  deletingPublicId,
  updatingReadPublicId,
  onReadFilterChange,
  onDeleteArticle,
  onToggleReadState,
  onRefresh,
}: ArticlesCardProps) {
  return (
    <Box style={readerSurfaceStyle}>
      <Stack gap="sm">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm" fw={700} c={readerHeadingColor}>
              Articles
            </Text>
            <Button
              variant="subtle"
              size="compact-sm"
              color="pink"
              onClick={onRefresh}
              loading={isRefreshing}
            >
              Refresh
            </Button>
          </Group>
          <SegmentedControl
            value={readFilter}
            onChange={(value) => {
              const nextFilter = parseReadFilter(value);
              if (nextFilter) {
                onReadFilterChange(nextFilter);
              }
            }}
            data={[
              {
                label: `Unread (${unreadArticlesCount})`,
                value: "unread",
              },
              { label: `Read (${readArticlesCount})`, value: "read" },
              { label: `All (${allArticlesCount})`, value: "all" },
            ]}
            size="xs"
            radius="md"
            color="pink"
            fullWidth
          />
        </Stack>
        <ArticlesBody
          isLoading={isLoading}
          errorMessage={errorMessage}
          readFilter={readFilter}
          articles={articles}
          hasAnyArticles={allArticlesCount > 0}
          deletingPublicId={deletingPublicId}
          updatingReadPublicId={updatingReadPublicId}
          onDeleteArticle={onDeleteArticle}
          onToggleReadState={onToggleReadState}
        />
      </Stack>
    </Box>
  );
}

export default function ReaderDashboardPage() {
  const controls = useReaderDashboardControls();
  const [addSourceMode, setAddSourceMode] = useState<AddSourceMode>("url");
  const router = useRouter();
  const [openingBook, setOpeningBook] = useState(false);
  const [relinkingPublicId, setRelinkingPublicId] = useState<
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
  const books = useMemo<ReaderBookSummary[]>(() => {
    return bookQuery.data?.books ?? [];
  }, [bookQuery.data]);
  const bookListErrorMessage = useMemo(() => {
    if (!bookQuery.isError) {
      return null;
    }

    return mutationErrorMessage(
      bookQuery.error,
      "Couldn't load your books.",
    );
  }, [bookQuery.error, bookQuery.isError]);

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
      targetFormat: "REFLOWABLE_EPUB",
      navigationJson: manifest.navigationJson,
      spineJson: manifest.spineJson,
    });

    await saveLocalBookHandle({
      fingerprint: manifest.fingerprint,
      serverPublicId: result.book.publicId,
      file: parsedLocalBook.file,
      handle: parsedLocalBook.handle,
    });
    await saveLocalManifestCache(manifest);
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

    const linkedManifest = manifestForRelinkedReaderBook({
      book,
      manifest,
    });
    await saveLocalBookHandle({
      fingerprint: book.fingerprint,
      serverPublicId: book.publicId,
      file: parsedLocalBook.file,
      handle: parsedLocalBook.handle,
    });
    await saveLocalManifestCache(linkedManifest);
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
        message: "Saved to your Reader library.",
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
            <ReaderShortcuts includeBookmarklet={false} />
          </Stack>
        </Box>

        <Box style={readerContentColumnStyle}>
          <Stack gap="sm">
            <BooksCard
              books={books}
              isLoading={bookQuery.isLoading}
              isRefreshing={bookQuery.isFetching}
              errorMessage={bookListErrorMessage}
              availabilityByFingerprint={availabilityByFingerprint}
              coverByFingerprint={coverByFingerprint}
              relinkingPublicId={relinkingPublicId}
              onRefresh={() => bookQuery.refetch()}
              onRelinkBook={handleRelinkBook}
            />
            <ArticlesCard
              articles={controls.articles}
              isLoading={controls.isArticlesLoading}
              isRefreshing={controls.isArticlesRefreshing}
              errorMessage={controls.listErrorMessage}
              readFilter={controls.readFilter}
              allArticlesCount={controls.allArticlesCount}
              readArticlesCount={controls.readArticlesCount}
              unreadArticlesCount={controls.unreadArticlesCount}
              deletingPublicId={controls.deletingPublicId}
              updatingReadPublicId={controls.updatingReadPublicId}
              onReadFilterChange={controls.onReadFilterChange}
              onDeleteArticle={controls.onDeleteArticle}
              onToggleReadState={controls.onToggleReadState}
              onRefresh={controls.onRefreshArticles}
            />
          </Stack>
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
