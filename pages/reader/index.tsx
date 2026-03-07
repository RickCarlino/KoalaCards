import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { useReaderDashboardControls } from "@/koala/reader/ui/dashboard/use-reader-dashboard-controls";
import type {
  ReaderArticleSummary,
  ReaderReadFilter,
} from "@/koala/reader/ui/dashboard/types";
import {
  formatReaderDateTime,
  readerHeadingColor,
  readerIngestLabel,
  readerListRowStyle,
} from "@/koala/reader/ui/theme";
import {
  Anchor,
  Box,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import React, { useState } from "react";

type AddSourceMode = "url" | "raw";

const RAW_TEXT_LENGTH_LIMIT = 240000;
const RAW_TEXT_WARNING_THRESHOLD = 220000;

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

const readerLibraryColumnStyle: React.CSSProperties = {
  flex: "2 1 560px",
  minWidth: 0,
};

const readerSurfaceStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid #efd8e4",
  background: "rgba(255, 255, 255, 0.96)",
  padding: "10px 12px",
};

function parseAddSourceMode(value: string): AddSourceMode | null {
  if (value === "url" || value === "raw") {
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

type LibraryBodyProps = {
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

function LibraryBody({
  isLoading,
  errorMessage,
  readFilter,
  articles,
  hasAnyArticles,
  deletingPublicId,
  updatingReadPublicId,
  onDeleteArticle,
  onToggleReadState,
}: LibraryBodyProps) {
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

type LibraryCardProps = {
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

function LibraryCard({
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
}: LibraryCardProps) {
  return (
    <Box style={readerSurfaceStyle}>
      <Stack gap="sm">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm" fw={700} c={readerHeadingColor}>
              Library
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
        <LibraryBody
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

  return (
    <Box style={readerPageStyle}>
      <Box style={readerHeaderRowStyle}>
        <Text size="xl" fw={700} c={readerHeadingColor}>
          Reader
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
              onArticleUrlChange={controls.onArticleUrlChange}
              onRawTitleChange={controls.onRawTitleChange}
              onRawTextChange={controls.onRawTextChange}
              onSaveUrlSubmit={controls.onSaveUrlSubmit}
              onSaveRawTextSubmit={controls.onSaveRawTextSubmit}
            />
            <ReaderShortcuts includeBookmarklet={false} />
          </Stack>
        </Box>

        <Box style={readerLibraryColumnStyle}>
          <LibraryCard
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
