import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import {
  ReaderPageFrame,
  ReaderPageHeader,
  ReaderPanel,
} from "@/koala/reader/ui/layout";
import { useReaderDashboardControls } from "@/koala/reader/ui/dashboard/use-reader-dashboard-controls";
import type {
  ReaderArticleSummary,
  ReaderDashboardStats,
} from "@/koala/reader/ui/dashboard/types";
import {
  formatReaderDateTime,
  readerBodyFont,
  readerIngestLabel,
  readerIngestTone,
  readerLanguageLabel,
  readerSubtleCardStyle,
} from "@/koala/reader/ui/theme";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import React, { useMemo } from "react";

function canRefreshArticle(article: ReaderArticleSummary): boolean {
  return (
    article.ingestStatus === "ready" || article.ingestStatus === "error"
  );
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

type IntegrationsCardProps = {
  articleCount: number;
};

function IntegrationsCard({ articleCount }: IntegrationsCardProps) {
  return (
    <ReaderPanel>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text
          size="sm"
          style={{ color: "#6e4e5c", fontFamily: readerBodyFont }}
        >
          {articleCount} article(s) on your shelf.
        </Text>
        <Group gap="xs">
          <Button
            component={Link}
            href="/reader/bookmarklet"
            variant="light"
            color="pink"
            size="xs"
          >
            Bookmarklet
          </Button>
          <Button
            component={Link}
            href="/reader/instapaper"
            variant="light"
            color="pink"
            size="xs"
          >
            Instapaper
          </Button>
        </Group>
      </Group>
    </ReaderPanel>
  );
}

type CaptureCardProps = {
  articleUrl: string;
  isSaving: boolean;
  onArticleUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function CaptureCard({
  articleUrl,
  isSaving,
  onArticleUrlChange,
  onSubmit,
}: CaptureCardProps) {
  return (
    <ReaderPanel>
      <Stack gap="xs">
        <Text fw={700} size="sm" style={{ color: "#4f3241" }}>
          Save a New Article
        </Text>
        <form onSubmit={onSubmit}>
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <TextInput
              aria-label="Article URL"
              placeholder="https://example.com/article"
              value={articleUrl}
              onChange={(event) =>
                onArticleUrlChange(event.currentTarget.value)
              }
              required
              style={{ flex: 1 }}
            />
            <Button type="submit" color="pink" loading={isSaving}>
              Save
            </Button>
          </Group>
        </form>
      </Stack>
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
  isRefreshing: boolean;
  onDelete: () => void;
  onRefresh: () => void;
  withDivider: boolean;
};

function ArticleRow({
  article,
  isDeleting,
  isRefreshing,
  onDelete,
  onRefresh,
  withDivider,
}: ArticleRowProps) {
  const statusTone = readerIngestTone(article.ingestStatus);
  const statusLabel = readerIngestLabel(article.ingestStatus);
  const canRefresh = canRefreshArticle(article);
  const subtitleParts = [statusLabel];

  if (article.ingestStatus === "ready") {
    subtitleParts.unshift(readerLanguageLabel(article.sourceLang));
  }

  return (
    <Stack
      gap={6}
      pt={withDivider ? "sm" : 0}
      mt={withDivider ? "sm" : 0}
      style={withDivider ? { borderTop: "1px solid #efd8e4" } : undefined}
    >
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="xs"
      >
        <Stack gap={3} style={{ maxWidth: "min(72ch, 100%)" }}>
          <Anchor
            component={Link}
            href={`/reader/${article.publicId}`}
            style={{ fontWeight: 700, color: "#533241", lineHeight: 1.35 }}
          >
            {article.title}
          </Anchor>
          <Group gap={6} wrap="wrap">
            <Badge color={statusTone} variant="light" size="sm">
              {statusLabel}
            </Badge>
            <Text size="xs" c="dimmed">
              {subtitleParts.join(" · ")} ·{" "}
              {formatReaderDateTime(article.createdAt)}
            </Text>
          </Group>
        </Stack>
        <Group gap={6} align="center">
          <Anchor
            href={article.normalizedUrl}
            target="_blank"
            rel="noreferrer"
            size="xs"
          >
            Source ↗
          </Anchor>
          {canRefresh && (
            <Button
              variant="subtle"
              color="pink"
              size="compact-xs"
              loading={isRefreshing}
              onClick={onRefresh}
            >
              Refresh
            </Button>
          )}
          <Button
            variant="subtle"
            color="red"
            size="compact-xs"
            loading={isDeleting}
            disabled={isRefreshing}
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
  refreshingPublicId: string | null;
  onDeleteArticle: (article: ReaderArticleSummary) => void;
  onRefreshArticle: (article: ReaderArticleSummary) => void;
  onRefresh: () => void;
};

function LibraryCard({
  articles,
  isLoading,
  isRefreshing,
  errorMessage,
  deletingPublicId,
  refreshingPublicId,
  onDeleteArticle,
  onRefreshArticle,
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
          Your shelf is empty. Save an article to begin your next study
          session.
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
              isRefreshing={refreshingPublicId === article.publicId}
              onDelete={() => onDeleteArticle(article)}
              onRefresh={() => onRefreshArticle(article)}
              withDivider={index > 0}
            />
          );
        })}
      </Stack>
    );
  }

  return (
    <ReaderPanel>
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Text fw={700} style={{ color: "#4f3241" }}>
          Library
        </Text>
        <Button
          variant="subtle"
          size="xs"
          onClick={onRefresh}
          loading={isRefreshing}
        >
          Refresh
        </Button>
      </Group>
      <StatsStrip stats={stats} />
      {body}
    </ReaderPanel>
  );
}

export default function ReaderDashboardPage() {
  const controls = useReaderDashboardControls();

  return (
    <ReaderPageFrame>
      <ReaderPageHeader
        title="Reader"
        subtitle="A calm reading shelf for Korean study. Save links, wait for processing, and keep your library tidy."
      />
      <IntegrationsCard articleCount={controls.articles.length} />
      <CaptureCard
        articleUrl={controls.articleUrl}
        isSaving={controls.isSaving}
        onArticleUrlChange={controls.onArticleUrlChange}
        onSubmit={controls.onSaveSubmit}
      />
      <LibraryCard
        articles={controls.articles}
        isLoading={controls.isArticlesLoading}
        isRefreshing={controls.isArticlesRefreshing}
        errorMessage={controls.listErrorMessage}
        deletingPublicId={controls.deletingPublicId}
        refreshingPublicId={controls.refreshingPublicId}
        onDeleteArticle={controls.onDeleteArticle}
        onRefreshArticle={controls.onRefreshArticle}
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
