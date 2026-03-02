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
import { useRouter } from "next/router";
import React, { useMemo, useState } from "react";

type AddSourceMode = "url" | "raw";
type AddSourceSelection = AddSourceMode | "instapaper";

function parseAddSourceSelection(
  value: string,
): AddSourceSelection | null {
  if (value === "url" || value === "raw" || value === "instapaper") {
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

function readerInputLabel(
  inputKind: ReaderArticleSummary["inputKind"],
): string {
  if (inputKind === "raw") {
    return "Raw text";
  }

  return "URL";
}

function readerInputTone(
  inputKind: ReaderArticleSummary["inputKind"],
): "gray" | "pink" {
  if (inputKind === "raw") {
    return "gray";
  }

  return "pink";
}

type AddFromCardProps = {
  mode: AddSourceMode;
  onModeChange: (nextMode: AddSourceSelection) => void;
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
  const modePanels: Record<AddSourceMode, React.ReactNode> = {
    url: (
      <form onSubmit={onSaveUrlSubmit}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Save a URL and let Reader fetch and prepare it.
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
          <Group gap={6}>
            <Anchor component={Link} href="/reader/bookmarklet" size="sm">
              Bookmarklet setup
            </Anchor>
          </Group>
        </Stack>
      </form>
    ),
    raw: (
      <form onSubmit={onSaveRawTextSubmit}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Paste plain text. Reader stores it as-is and makes it ready
            immediately.
          </Text>
          <TextInput
            aria-label="Optional title"
            placeholder="Optional title"
            value={rawTitle}
            onChange={(event) =>
              onRawTitleChange(event.currentTarget.value)
            }
            maxLength={400}
          />
          <Textarea
            aria-label="Raw text"
            placeholder="Paste raw text here..."
            autosize
            minRows={8}
            maxRows={16}
            value={rawText}
            onChange={(event) =>
              onRawTextChange(event.currentTarget.value)
            }
            required
          />
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="xs" c="dimmed">
              HTML is never rendered. This is plain text only.
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
    ),
  };

  return (
    <ReaderPanel>
      <ReaderPanelHeader
        title="Add From"
        subtitle="URL, raw text, or Instapaper"
      />
      <SegmentedControl
        value={mode}
        onChange={(nextMode) => {
          const parsedMode = parseAddSourceSelection(nextMode);
          if (parsedMode) {
            onModeChange(parsedMode);
          }
        }}
        data={[
          { label: "URL", value: "url" },
          { label: "Raw", value: "raw" },
          { label: "Instapaper", value: "instapaper" },
        ]}
        radius="xl"
        color="pink"
      />
      {modePanels[mode]}
    </ReaderPanel>
  );
}

type StatsStripProps = {
  stats: ReaderDashboardStats;
};

function StatsStrip({ stats }: StatsStripProps) {
  return (
    <Group gap="xs" wrap="wrap">
      <Badge color="yellow" variant="light">
        Queued {stats.queued}
      </Badge>
      <Badge color="grape" variant="light">
        Processing {stats.processing}
      </Badge>
      <Badge color="teal" variant="light">
        Ready {stats.ready}
      </Badge>
      <Badge color="red" variant="light">
        Error {stats.errored}
      </Badge>
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
  const subtitleParts = [readerInputLabel(article.inputKind), statusLabel];

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
          style={{ maxWidth: "min(72ch, 100%)", flex: "1 1 340px" }}
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
            <Badge
              color={readerInputTone(article.inputKind)}
              variant="light"
              size="sm"
            >
              {readerInputLabel(article.inputKind)}
            </Badge>
            <Text size="xs" c="dimmed">
              {subtitleParts.join(" · ")} ·{" "}
              {formatReaderDateTime(article.createdAt)}
            </Text>
          </Group>
        </Stack>
        <Group gap={6} align="center" wrap="wrap">
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
        <Text size="sm" c="dimmed" lineClamp={1}>
          {article.description}
        </Text>
      )}
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
  const stats = useMemo(() => buildDashboardStats(articles), [articles]);

  let body: React.ReactNode = null;

  if (isLoading) {
    body = (
      <Text size="sm" c="dimmed">
        Loading your shelf...
      </Text>
    );
  }

  if (!isLoading && errorMessage) {
    body = <Text c="red">{errorMessage}</Text>;
  }

  if (!isLoading && !errorMessage && articles.length === 0) {
    body = (
      <Box style={readerSubtleCardStyle}>
        <Text size="sm" c="dimmed">
          Your shelf is empty. Add from URL, raw text, or Instapaper to
          begin.
        </Text>
      </Box>
    );
  }

  if (!isLoading && !errorMessage && articles.length > 0) {
    body = (
      <Stack gap={0}>
        {articles.map((article, index) => {
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

  return (
    <ReaderPanel>
      <ReaderPanelHeader
        title="Library"
        subtitle="Recent saves and ingest status."
        rightSlot={
          <Button
            variant="subtle"
            size="xs"
            color="pink"
            onClick={onRefresh}
            loading={isRefreshing}
          >
            Refresh List
          </Button>
        }
      />
      <StatsStrip stats={stats} />
      {body}
    </ReaderPanel>
  );
}

export default function ReaderDashboardPage() {
  const router = useRouter();
  const controls = useReaderDashboardControls();
  const [addSourceMode, setAddSourceMode] = useState<AddSourceMode>("url");

  const handleAddSourceModeChange = (nextMode: AddSourceSelection) => {
    if (nextMode === "instapaper") {
      void router.push("/reader/instapaper");
      return;
    }

    setAddSourceMode(nextMode);
  };

  return (
    <ReaderPageFrame>
      <ReaderPageHeader
        title="Reader"
        subtitle="One shelf for imported study content. Add from URL, raw text, or Instapaper."
      />
      <AddFromCard
        mode={addSourceMode}
        onModeChange={handleAddSourceModeChange}
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
      <LibraryCard
        articles={controls.articles}
        isLoading={controls.isArticlesLoading}
        isRefreshing={controls.isArticlesRefreshing}
        errorMessage={controls.listErrorMessage}
        deletingPublicId={controls.deletingPublicId}
        onDeleteArticle={controls.onDeleteArticle}
        onRefresh={controls.onRefreshArticles}
      />
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
