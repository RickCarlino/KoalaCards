import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import {
  ReaderPageFrame,
  ReaderPageHeader,
  ReaderPanel,
  ReaderPanelHeader,
} from "@/koala/reader/ui/layout";
import { useReaderDashboardControls } from "@/koala/reader/ui/dashboard/use-reader-dashboard-controls";
import type {
  ReaderArticleSummary,
  ReaderDashboardStats,
} from "@/koala/reader/ui/dashboard/types";
import {
  formatReaderDateTime,
  readerHeadingColor,
  readerIngestLabel,
  readerIngestTone,
  readerListRowStyle,
  readerSubtleCardStyle,
} from "@/koala/reader/ui/theme";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import React, { useMemo, useState } from "react";

type AddSourceMode = "url" | "raw";
type LibraryFilterMode = "all" | "active" | "ready" | "error";

const RAW_TEXT_LENGTH_LIMIT = 240000;
const RAW_TEXT_WARNING_THRESHOLD = 220000;

const readerDashboardLayoutStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: "clamp(12px, 1.8vw, 20px)",
};

const readerAddColumnStyle: React.CSSProperties = {
  flex: "1 1 330px",
  minWidth: 0,
  maxWidth: 440,
};

const readerLibraryColumnStyle: React.CSSProperties = {
  flex: "2 1 560px",
  minWidth: 0,
};

const readerStatTileStyle: React.CSSProperties = {
  ...readerSubtleCardStyle,
  minWidth: 94,
  padding: "8px 12px",
};

function parseAddSourceMode(value: string): AddSourceMode | null {
  if (value === "url" || value === "raw") {
    return value;
  }

  return null;
}

function buildDashboardStats(
  articles: ReaderArticleSummary[],
): ReaderDashboardStats {
  let queued = 0;
  let processing = 0;
  let ready = 0;
  let errored = 0;

  for (const article of articles) {
    if (article.ingestStatus === "pending") {
      queued += 1;
    }

    if (article.ingestStatus === "in_progress") {
      processing += 1;
    }

    if (article.ingestStatus === "ready") {
      ready += 1;
    }

    if (article.ingestStatus === "error") {
      errored += 1;
    }
  }

  return {
    queued,
    processing,
    ready,
    errored,
  };
}

function isActiveStatus(
  status: ReaderArticleSummary["ingestStatus"],
): boolean {
  return status === "pending" || status === "in_progress";
}

function shouldIncludeArticle(
  article: ReaderArticleSummary,
  mode: LibraryFilterMode,
): boolean {
  if (mode === "all") {
    return true;
  }

  if (mode === "active") {
    return isActiveStatus(article.ingestStatus);
  }

  if (mode === "ready") {
    return article.ingestStatus === "ready";
  }

  return article.ingestStatus === "error";
}

function filteredEmptyMessage(
  mode: LibraryFilterMode,
  hasAnyArticles: boolean,
): string {
  if (!hasAnyArticles) {
    return "Your shelf is empty. Add from URL or plain text to begin.";
  }

  if (mode === "active") {
    return "No queued or processing articles right now.";
  }

  if (mode === "ready") {
    return "Nothing is ready yet. Try refreshing in a moment.";
  }

  return "No ingest errors. Your queue looks healthy.";
}

type ReaderShortcutsProps = {
  includeBookmarklet: boolean;
};

function ReaderShortcuts({ includeBookmarklet }: ReaderShortcutsProps) {
  return (
    <Group gap="sm" wrap="wrap">
      <Anchor component={Link} href="/reader/instapaper" size="sm">
        Instapaper Sync
      </Anchor>
      {includeBookmarklet && (
        <Anchor component={Link} href="/reader/bookmarklet" size="sm">
          Bookmarklet Setup
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
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Save a webpage URL. Reader queues fetch + cleanup automatically.
        </Text>
        <Group gap="xs" wrap="wrap" align="flex-end">
          <TextInput
            aria-label="Article URL"
            placeholder="https://example.com/article"
            value={articleUrl}
            onChange={(event) =>
              onArticleUrlChange(event.currentTarget.value)
            }
            required
            style={{ flex: "1 1 320px" }}
          />
          <Button
            type="submit"
            color="pink"
            loading={isSavingUrl}
            style={{ minWidth: 112 }}
          >
            Queue URL
          </Button>
        </Group>
      </Stack>
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
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Paste plain text notes or transcripts. Text saves are ready
          instantly.
        </Text>
        <TextInput
          aria-label="Optional title"
          placeholder="Optional title"
          value={rawTitle}
          onChange={(event) => onRawTitleChange(event.currentTarget.value)}
          maxLength={400}
        />
        <Textarea
          aria-label="Raw text"
          placeholder="Paste raw text here..."
          autosize
          minRows={8}
          maxRows={18}
          value={rawText}
          onChange={(event) => onRawTextChange(event.currentTarget.value)}
          required
        />
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="xs" c={rawTextTone}>
            {rawTextLength.toLocaleString()} /{" "}
            {RAW_TEXT_LENGTH_LIMIT.toLocaleString()} characters
          </Text>
          <Button
            type="submit"
            color="pink"
            loading={isSavingRaw}
            style={{ minWidth: 100 }}
          >
            Save Text
          </Button>
        </Group>
      </Stack>
    </form>
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
  onArticleUrlChange: (value: string) => void;
  onRawTitleChange: (value: string) => void;
  onRawTextChange: (value: string) => void;
  onSaveUrlSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveRawTextSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function AddFromCard({
  mode,
  onModeChange,
  articleUrl,
  rawTitle,
  rawText,
  isSavingUrl,
  isSavingRaw,
  onArticleUrlChange,
  onRawTitleChange,
  onRawTextChange,
  onSaveUrlSubmit,
  onSaveRawTextSubmit,
}: AddFromCardProps) {
  return (
    <ReaderPanel>
      <ReaderPanelHeader
        title="Add to Shelf"
        subtitle="Choose one source and save it in seconds."
      />
      <SegmentedControl
        value={mode}
        onChange={(nextMode) => {
          const parsedMode = parseAddSourceMode(nextMode);
          if (parsedMode) {
            onModeChange(parsedMode);
          }
        }}
        data={[
          { label: "Web URL", value: "url" },
          { label: "Plain Text", value: "raw" },
        ]}
        radius="xl"
        color="pink"
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
    </ReaderPanel>
  );
}

type StatsStripProps = {
  stats: ReaderDashboardStats;
};

function StatsStrip({ stats }: StatsStripProps) {
  const total =
    stats.queued + stats.processing + stats.ready + stats.errored;

  const readyRatio =
    total === 0 ? 0 : Math.round((stats.ready / total) * 100);

  const tiles = [
    { label: "Queued", value: stats.queued, color: "yellow" },
    { label: "Processing", value: stats.processing, color: "grape" },
    { label: "Ready", value: stats.ready, color: "teal" },
    { label: "Errors", value: stats.errored, color: "red" },
  ] as const;

  return (
    <Stack gap={8}>
      <Group gap="xs" wrap="wrap">
        {tiles.map((tile) => {
          return (
            <Box key={tile.label} style={readerStatTileStyle}>
              <Text fw={700} size="md" c={tile.color}>
                {tile.value}
              </Text>
              <Text size="xs" c="dimmed">
                {tile.label}
              </Text>
            </Box>
          );
        })}
      </Group>
      <Text size="xs" c="dimmed">
        Shelf readiness: {readyRatio}% ready
      </Text>
    </Stack>
  );
}

type LibraryFiltersProps = {
  mode: LibraryFilterMode;
  stats: ReaderDashboardStats;
  totalCount: number;
  onModeChange: (nextMode: LibraryFilterMode) => void;
};

function LibraryFilters({
  mode,
  stats,
  totalCount,
  onModeChange,
}: LibraryFiltersProps) {
  const options: {
    mode: LibraryFilterMode;
    label: string;
    count: number;
  }[] = [
    { mode: "all", label: "All", count: totalCount },
    {
      mode: "active",
      label: "Active",
      count: stats.queued + stats.processing,
    },
    { mode: "ready", label: "Ready", count: stats.ready },
    { mode: "error", label: "Errors", count: stats.errored },
  ];

  return (
    <Group gap={6} wrap="wrap">
      {options.map((option) => {
        const selected = option.mode === mode;

        return (
          <Button
            key={option.mode}
            size="compact-sm"
            variant={selected ? "filled" : "light"}
            color="pink"
            onClick={() => onModeChange(option.mode)}
          >
            {option.label} ({option.count})
          </Button>
        );
      })}
    </Group>
  );
}

type ArticleRowProps = {
  article: ReaderArticleSummary;
  isDeleting: boolean;
  onDelete: () => void;
  withDivider: boolean;
};

function ArticleRow({
  article,
  isDeleting,
  onDelete,
  withDivider,
}: ArticleRowProps) {
  const statusTone = readerIngestTone(article.ingestStatus);
  const statusLabel = readerIngestLabel(article.ingestStatus);

  return (
    <Stack style={readerListRowStyle(withDivider)}>
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="sm"
      >
        <Stack
          gap={4}
          style={{ maxWidth: "min(76ch, 100%)", flex: "1 1 340px" }}
        >
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
          <Group gap={6} wrap="wrap">
            <Badge color={statusTone} variant="light" size="sm">
              {statusLabel}
            </Badge>
            <Text size="xs" c="dimmed">
              Added {formatReaderDateTime(article.createdAt)}
            </Text>
          </Group>
        </Stack>
        <Group gap={8} align="center" wrap="wrap">
          <Anchor
            component={Link}
            href={`/reader/${article.publicId}`}
            size="xs"
          >
            Open
          </Anchor>
          {article.normalizedUrl && (
            <Anchor
              href={article.normalizedUrl}
              target="_blank"
              rel="noreferrer"
              size="xs"
            >
              Source ↗
            </Anchor>
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
        </Group>
      </Group>

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
  );
}

type LibraryBodyProps = {
  isLoading: boolean;
  errorMessage: string | null;
  filteredArticles: ReaderArticleSummary[];
  hasAnyArticles: boolean;
  filterMode: LibraryFilterMode;
  deletingPublicId: string | null;
  onDeleteArticle: (article: ReaderArticleSummary) => void;
};

function LibraryBody({
  isLoading,
  errorMessage,
  filteredArticles,
  hasAnyArticles,
  filterMode,
  deletingPublicId,
  onDeleteArticle,
}: LibraryBodyProps) {
  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading your shelf...
      </Text>
    );
  }

  if (errorMessage) {
    return <Text c="red">{errorMessage}</Text>;
  }

  if (filteredArticles.length === 0) {
    return (
      <Box style={readerSubtleCardStyle}>
        <Text size="sm" c="dimmed">
          {filteredEmptyMessage(filterMode, hasAnyArticles)}
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap={0}>
      {filteredArticles.map((article, index) => {
        return (
          <ArticleRow
            key={article.id}
            article={article}
            isDeleting={deletingPublicId === article.publicId}
            onDelete={() => onDeleteArticle(article)}
            withDivider={index > 0}
          />
        );
      })}
    </Stack>
  );
}

type LibraryCardProps = {
  articles: ReaderArticleSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  deletingPublicId: string | null;
  onDeleteArticle: (article: ReaderArticleSummary) => void;
  onRefresh: () => void;
};

function LibraryCard({
  articles,
  isLoading,
  isRefreshing,
  errorMessage,
  deletingPublicId,
  onDeleteArticle,
  onRefresh,
}: LibraryCardProps) {
  const [filterMode, setFilterMode] = useState<LibraryFilterMode>("all");

  const stats = useMemo(() => buildDashboardStats(articles), [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      return shouldIncludeArticle(article, filterMode);
    });
  }, [articles, filterMode]);

  return (
    <ReaderPanel>
      <ReaderPanelHeader
        title="Library"
        subtitle="Review ingest status, then open articles when ready."
        rightSlot={
          <Button
            variant="subtle"
            size="xs"
            color="pink"
            onClick={onRefresh}
            loading={isRefreshing}
          >
            Refresh
          </Button>
        }
      />
      <StatsStrip stats={stats} />
      <LibraryFilters
        mode={filterMode}
        stats={stats}
        totalCount={articles.length}
        onModeChange={setFilterMode}
      />
      <LibraryBody
        isLoading={isLoading}
        errorMessage={errorMessage}
        filteredArticles={filteredArticles}
        hasAnyArticles={articles.length > 0}
        filterMode={filterMode}
        deletingPublicId={deletingPublicId}
        onDeleteArticle={onDeleteArticle}
      />
    </ReaderPanel>
  );
}

export default function ReaderDashboardPage() {
  const controls = useReaderDashboardControls();
  const [addSourceMode, setAddSourceMode] = useState<AddSourceMode>("url");

  return (
    <ReaderPageFrame>
      <ReaderPageHeader
        title="Reader"
        subtitle="Capture content, let Reader prepare it, then open when ready."
        rightSlot={<ReaderShortcuts includeBookmarklet={false} />}
      />

      <Box style={readerDashboardLayoutStyle}>
        <Stack gap="md" style={readerAddColumnStyle}>
          <AddFromCard
            mode={addSourceMode}
            onModeChange={setAddSourceMode}
            articleUrl={controls.articleUrl}
            rawTitle={controls.rawTitle}
            rawText={controls.rawText}
            isSavingUrl={controls.isSavingUrl}
            isSavingRaw={controls.isSavingRaw}
            onArticleUrlChange={controls.onArticleUrlChange}
            onRawTitleChange={controls.onRawTitleChange}
            onRawTextChange={controls.onRawTextChange}
            onSaveUrlSubmit={controls.onSaveUrlSubmit}
            onSaveRawTextSubmit={controls.onSaveRawTextSubmit}
          />
        </Stack>

        <Box style={readerLibraryColumnStyle}>
          <LibraryCard
            articles={controls.articles}
            isLoading={controls.isArticlesLoading}
            isRefreshing={controls.isArticlesRefreshing}
            errorMessage={controls.listErrorMessage}
            deletingPublicId={controls.deletingPublicId}
            onDeleteArticle={controls.onDeleteArticle}
            onRefresh={controls.onRefreshArticles}
          />
        </Box>
      </Box>
    </ReaderPageFrame>
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
