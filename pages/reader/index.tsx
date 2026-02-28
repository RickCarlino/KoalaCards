import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { trpc } from "@/koala/trpc-config";
import {
  Anchor,
  Button,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import React, { useMemo, useState } from "react";

type ReaderArticleSummary = {
  id: number;
  publicId: string;
  title: string;
  normalizedUrl: string;
  description: string;
  sourceLang: "ko" | "en" | "other";
  translated: boolean;
  ingestStatus: "pending" | "in_progress" | "ready" | "error";
  ingestError: string;
  createdAt: Date;
};

const pageShellStyle: React.CSSProperties = {
  borderRadius: 28,
  border: "1px solid #f0d4e2",
  background:
    "linear-gradient(160deg, #fffdfd 0%, #fff8fc 54%, #fff2f8 100%)",
  boxShadow: "0 18px 34px rgba(176, 97, 136, 0.1)",
  padding: "clamp(14px, 2vw, 24px)",
};

const headlineFont =
  '"Palatino Linotype", "Book Antiqua", Palatino, serif';

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatDateTime(value: Date): string {
  return value.toLocaleString();
}

function articleStateLabel(article: ReaderArticleSummary): string {
  if (article.ingestStatus === "pending") {
    return "Queued";
  }

  if (article.ingestStatus === "in_progress") {
    return "Processing";
  }

  if (article.ingestStatus === "error") {
    return "Error";
  }

  return "Ready";
}

function sourceLanguageLabel(sourceLang: "ko" | "en" | "other"): string {
  if (sourceLang === "ko") {
    return "Korean";
  }

  if (sourceLang === "en") {
    return "English";
  }

  return "Other";
}

function ReaderIntroHeader() {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap">
      <Stack gap={3}>
        <Title order={2} style={{ fontFamily: headlineFont }}>
          Reader
        </Title>
        <Text size="sm" c="dimmed">
          Save articles by URL and read them in a clean format.
        </Text>
      </Stack>
      <Text size="sm" c="dimmed">
        You can also use the{" "}
        <Anchor component={Link} href="/reader/bookmarklet">
          Koala Bookmarklet
        </Anchor>{" "}
        or{" "}
        <Anchor component={Link} href="/reader/instapaper">
          Instapaper tools
        </Anchor>
        .
      </Text>
    </Group>
  );
}

type QuickCaptureBarProps = {
  articleUrl: string;
  isSaving: boolean;
  onArticleUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function QuickCaptureBar({
  articleUrl,
  isSaving,
  onArticleUrlChange,
  onSubmit,
}: QuickCaptureBarProps) {
  return (
    <Stack gap="xs">
      <Text fw={700} style={{ fontFamily: headlineFont }}>
        Save by URL
      </Text>
      <form onSubmit={onSubmit}>
        <Group gap="xs" align="flex-end" wrap="nowrap">
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
  );
}

type LibraryShelfProps = {
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

type LibraryRowProps = {
  article: ReaderArticleSummary;
  isDeleting: boolean;
  isRefreshing: boolean;
  onDelete: () => void;
  onRefresh: () => void;
  withDivider: boolean;
};

function canRefreshArticle(article: ReaderArticleSummary): boolean {
  return (
    article.ingestStatus === "ready" || article.ingestStatus === "error"
  );
}

function LibraryRow({
  article,
  isDeleting,
  isRefreshing,
  onDelete,
  onRefresh,
  withDivider,
}: LibraryRowProps) {
  const statusLabel = articleStateLabel(article);
  const subtitle =
    article.ingestStatus === "ready"
      ? `${sourceLanguageLabel(article.sourceLang)} · ${statusLabel}`
      : statusLabel;
  const showRefreshAction = canRefreshArticle(article);

  return (
    <Stack
      gap={4}
      pt={withDivider ? "sm" : 0}
      mt={withDivider ? "sm" : 0}
      style={withDivider ? { borderTop: "1px solid #efd9e4" } : undefined}
    >
      <Anchor
        component={Link}
        href={`/reader/${article.publicId}`}
        style={{
          fontFamily: headlineFont,
          fontWeight: 600,
          fontSize: "1rem",
          lineHeight: 1.35,
        }}
      >
        {article.title}
      </Anchor>
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Text size="xs" c="dimmed">
          {subtitle} · {formatDateTime(article.createdAt)}
        </Text>
        <Group gap={6} align="center">
          <Anchor
            href={article.normalizedUrl}
            target="_blank"
            rel="noreferrer"
            size="xs"
          >
            Source ↗
          </Anchor>
          {showRefreshAction && (
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

function LibraryHeader({
  isRefreshing,
  onRefresh,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Group justify="space-between" align="center" wrap="wrap" gap="xs">
      <Text fw={700} style={{ fontFamily: headlineFont }}>
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
  );
}

function LibraryShelf({
  articles,
  isLoading,
  isRefreshing,
  errorMessage,
  deletingPublicId,
  refreshingPublicId,
  onDeleteArticle,
  onRefreshArticle,
  onRefresh,
}: LibraryShelfProps) {
  if (isLoading) {
    return (
      <Stack gap="sm">
        <LibraryHeader isRefreshing={isRefreshing} onRefresh={onRefresh} />
        <Text size="sm" c="dimmed">
          Loading your shelf...
        </Text>
      </Stack>
    );
  }

  if (errorMessage) {
    return (
      <Stack gap="sm">
        <LibraryHeader isRefreshing={isRefreshing} onRefresh={onRefresh} />
        <Text c="red">{errorMessage}</Text>
      </Stack>
    );
  }

  if (articles.length === 0) {
    return (
      <Stack gap="sm">
        <LibraryHeader isRefreshing={isRefreshing} onRefresh={onRefresh} />
        <Text size="sm" c="dimmed">
          Your shelf is empty. Save an article to get started.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <LibraryHeader isRefreshing={isRefreshing} onRefresh={onRefresh} />
      <Stack gap={0}>
        {articles.map((article, index) => {
          return (
            <LibraryRow
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
    </Stack>
  );
}

function useReaderControls() {
  const [articleUrl, setArticleUrl] = useState("");
  const [deletingPublicId, setDeletingPublicId] = useState<string | null>(
    null,
  );
  const [refreshingPublicId, setRefreshingPublicId] = useState<
    string | null
  >(null);

  const listQuery = trpc.listReaderArticlesRoute.useQuery(
    { limit: 40 },
    {
      refetchOnWindowFocus: false,
      refetchInterval: (data) => {
        const hasActiveIngest = (data?.articles ?? []).some((article) => {
          return (
            article.ingestStatus === "pending" ||
            article.ingestStatus === "in_progress"
          );
        });

        if (hasActiveIngest) {
          return 8000;
        }

        return false;
      },
    },
  );

  const saveArticle = trpc.saveReaderArticleRoute.useMutation();
  const deleteArticle = trpc.deleteReaderArticleRoute.useMutation();
  const refreshArticle = trpc.refreshReaderArticleRoute.useMutation();

  const listErrorMessage = useMemo(() => {
    if (!listQuery.isError) {
      return null;
    }

    return mutationErrorMessage(
      listQuery.error,
      "Could not load reader articles.",
    );
  }, [listQuery.error, listQuery.isError]);

  const handleSaveSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const trimmed = articleUrl.trim();
    if (!trimmed) {
      notifications.show({
        title: "Missing URL",
        message: "Please paste an article URL.",
        color: "red",
      });
      return;
    }

    try {
      const result = await saveArticle.mutateAsync({ url: trimmed });
      setArticleUrl("");
      notifications.show({
        title: "Queued",
        message: `Article #${result.article.id} queued for processing.`,
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Save failed",
        message: mutationErrorMessage(error, "Could not save article."),
        color: "red",
      });
    }
  };

  const handleDeleteArticle = async (
    article: ReaderArticleSummary,
  ): Promise<void> => {
    const shouldDelete = window.confirm(
      `Delete "${article.title}" from your library?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingPublicId(article.publicId);

    try {
      await deleteArticle.mutateAsync({ publicId: article.publicId });
      notifications.show({
        title: "Deleted",
        message: "Article removed from your library.",
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Delete failed",
        message: mutationErrorMessage(error, "Could not delete article."),
        color: "red",
      });
    } finally {
      setDeletingPublicId((current) => {
        if (current === article.publicId) {
          return null;
        }

        return current;
      });
    }
  };

  const handleRefreshArticle = async (
    article: ReaderArticleSummary,
  ): Promise<void> => {
    setRefreshingPublicId(article.publicId);

    try {
      await refreshArticle.mutateAsync({ publicId: article.publicId });
      notifications.show({
        title: "Queued",
        message: "Article queued for reprocessing.",
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Refresh failed",
        message: mutationErrorMessage(
          error,
          "Could not refresh this article.",
        ),
        color: "red",
      });
    } finally {
      setRefreshingPublicId((current) => {
        if (current === article.publicId) {
          return null;
        }

        return current;
      });
    }
  };

  return {
    articleUrl,
    deletingPublicId,
    refreshingPublicId,
    isSaving: saveArticle.isLoading,
    articles: listQuery.data?.articles ?? [],
    isArticlesLoading: listQuery.isLoading,
    isArticlesRefreshing: listQuery.isFetching,
    listErrorMessage,
    onArticleUrlChange: setArticleUrl,
    onDeleteArticle: handleDeleteArticle,
    onRefreshArticle: handleRefreshArticle,
    onSaveSubmit: handleSaveSubmit,
    onRefreshArticles: () => listQuery.refetch(),
  };
}

export default function ReaderDashboardPage() {
  const controls = useReaderControls();

  return (
    <Container size="lg" mt="xl" pb="xl">
      <Stack gap="lg" style={pageShellStyle}>
        <ReaderIntroHeader />
        <QuickCaptureBar
          articleUrl={controls.articleUrl}
          isSaving={controls.isSaving}
          onArticleUrlChange={controls.onArticleUrlChange}
          onSubmit={controls.onSaveSubmit}
        />
        <LibraryShelf
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
      </Stack>
    </Container>
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
