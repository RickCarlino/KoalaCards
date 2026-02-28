import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import { trpc } from "@/koala/trpc-config";
import {
  Anchor,
  Button,
  Checkbox,
  Container,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import React, { useState } from "react";

type ReaderIngestStatus = "pending" | "in_progress" | "ready" | "error";
type ReaderLanguage = "ko" | "en" | "other";

type InstapaperLocalArticle = {
  publicId: string;
  title: string;
  ingestStatus: ReaderIngestStatus;
  sourceLang: ReaderLanguage;
  translated: boolean;
  createdAt: Date;
  instapaperBookmarkId: string | null;
};

type InstapaperUnreadBookmark = {
  bookmarkId: string;
  url: string;
  title: string;
  description: string;
  normalizedUrl: string | null;
  urlError: string | null;
  localArticle: InstapaperLocalArticle | null;
};

type ImportSummary = {
  imported: number;
  duplicates: number;
  invalidUrls: number;
  failed: number;
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

function ingestStatusLabel(status: ReaderIngestStatus): string {
  if (status === "pending") {
    return "Queued";
  }

  if (status === "in_progress") {
    return "Processing";
  }

  if (status === "ready") {
    return "Ready";
  }

  return "Error";
}

function sourceLanguageLabel(language: ReaderLanguage): string {
  if (language === "ko") {
    return "Korean";
  }

  if (language === "en") {
    return "English";
  }

  return "Other";
}

function canExportBookmark(bookmark: InstapaperUnreadBookmark): boolean {
  if (!bookmark.localArticle) {
    return false;
  }

  return bookmark.localArticle.ingestStatus === "ready";
}

function rowStatusText(bookmark: InstapaperUnreadBookmark): string {
  if (bookmark.urlError) {
    return bookmark.urlError;
  }

  if (!bookmark.localArticle) {
    return "Not imported into Koala yet.";
  }

  const article = bookmark.localArticle;
  return `${sourceLanguageLabel(article.sourceLang)} · ${ingestStatusLabel(article.ingestStatus)}`;
}

function formatDateTime(value: Date): string {
  return value.toLocaleString();
}

function PageHeader() {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap">
      <Stack gap={3}>
        <Title order={2} style={{ fontFamily: headlineFont }}>
          Instapaper
        </Title>
        <Text size="sm" c="dimmed">
          Import unread bookmarks, then export Korean article content back
          to Instapaper.
        </Text>
      </Stack>
      <Button component={Link} href="/reader" variant="light" size="sm">
        Back to Reader
      </Button>
    </Group>
  );
}

type CredentialsPanelProps = {
  username: string;
  password: string;
  archiveOriginal: boolean;
  loading: boolean;
  importing: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onArchiveOriginalChange: (value: boolean) => void;
  onLoadUnread: () => Promise<void>;
  onImportUnread: () => Promise<void>;
};

function CredentialsPanel({
  username,
  password,
  archiveOriginal,
  loading,
  importing,
  onUsernameChange,
  onPasswordChange,
  onArchiveOriginalChange,
  onLoadUnread,
  onImportUnread,
}: CredentialsPanelProps) {
  return (
    <Stack gap="xs">
      <Text fw={700} style={{ fontFamily: headlineFont }}>
        Instapaper Credentials
      </Text>
      <Text size="sm" c="dimmed">
        Credentials are used for the current action only and are not stored
        in Koala.
      </Text>
      <Group align="flex-end" wrap="wrap">
        <TextInput
          label="Username"
          placeholder="you@example.com"
          value={username}
          onChange={(event) => onUsernameChange(event.currentTarget.value)}
          style={{ flex: "1 1 220px" }}
        />
        <PasswordInput
          label="Password"
          placeholder="Instapaper password"
          value={password}
          onChange={(event) => onPasswordChange(event.currentTarget.value)}
          style={{ flex: "1 1 220px" }}
        />
      </Group>
      <Group gap="xs" align="center" wrap="wrap">
        <Button color="pink" loading={loading} onClick={onLoadUnread}>
          Load Unread
        </Button>
        <Button
          variant="light"
          color="pink"
          loading={importing}
          onClick={onImportUnread}
        >
          Import Unread to Koala
        </Button>
      </Group>
      <Checkbox
        label="Archive original Instapaper bookmark after successful export"
        checked={archiveOriginal}
        onChange={(event) =>
          onArchiveOriginalChange(event.currentTarget.checked)
        }
      />
    </Stack>
  );
}

function ImportSummaryPanel({
  summary,
  errors,
}: {
  summary: ImportSummary | null;
  errors: string[];
}) {
  if (!summary) {
    return null;
  }

  return (
    <Stack gap={5}>
      <Text size="sm" fw={600}>
        Import summary: {summary.imported} imported, {summary.duplicates}{" "}
        duplicates, {summary.invalidUrls} invalid URL(s), {summary.failed}{" "}
        failed.
      </Text>
      {errors.length > 0 && (
        <Stack gap={2}>
          {errors.map((errorMessage, index) => {
            return (
              <Text key={`${errorMessage}-${index}`} size="sm" c="red">
                {errorMessage}
              </Text>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

type BookmarkRowProps = {
  bookmark: InstapaperUnreadBookmark;
  archiveOriginal: boolean;
  exportingPublicId: string | null;
  onExport: (bookmark: InstapaperUnreadBookmark) => Promise<void>;
  withDivider: boolean;
};

function BookmarkRow({
  bookmark,
  archiveOriginal,
  exportingPublicId,
  onExport,
  withDivider,
}: BookmarkRowProps) {
  const localArticle = bookmark.localArticle;
  const statusText = rowStatusText(bookmark);
  const exportable = canExportBookmark(bookmark);
  const isExporting =
    localArticle && exportingPublicId === localArticle.publicId;

  return (
    <Stack
      gap={5}
      pt={withDivider ? "sm" : 0}
      mt={withDivider ? "sm" : 0}
      style={withDivider ? { borderTop: "1px solid #efd9e4" } : undefined}
    >
      <Anchor
        href={bookmark.url}
        target="_blank"
        rel="noreferrer"
        style={{ fontWeight: 600, lineHeight: 1.35 }}
      >
        {bookmark.title}
      </Anchor>
      <Text size="sm" c={bookmark.urlError ? "red" : "dimmed"}>
        {statusText}
      </Text>
      {localArticle && (
        <Group gap="xs" wrap="wrap">
          <Anchor
            component={Link}
            href={`/reader/${localArticle.publicId}`}
            size="xs"
          >
            Open in Koala
          </Anchor>
          <Text size="xs" c="dimmed">
            Saved {formatDateTime(localArticle.createdAt)}
          </Text>
        </Group>
      )}
      {bookmark.description.trim().length > 0 && (
        <Text size="sm" c="dimmed" lineClamp={1}>
          {bookmark.description}
        </Text>
      )}
      {exportable && localArticle && (
        <Group gap="xs" align="center" wrap="wrap">
          <Button
            size="compact-sm"
            color="pink"
            loading={Boolean(isExporting)}
            onClick={() => onExport(bookmark)}
          >
            Export Korean to Instapaper
          </Button>
          <Text size="xs" c="dimmed">
            {archiveOriginal
              ? "Archives original after export"
              : "Keeps original unread bookmark"}
          </Text>
        </Group>
      )}
    </Stack>
  );
}

function BookmarkList({
  bookmarks,
  archiveOriginal,
  exportingPublicId,
  onExport,
}: {
  bookmarks: InstapaperUnreadBookmark[];
  archiveOriginal: boolean;
  exportingPublicId: string | null;
  onExport: (bookmark: InstapaperUnreadBookmark) => Promise<void>;
}) {
  if (bookmarks.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No unread bookmarks loaded yet.
      </Text>
    );
  }

  return (
    <Stack gap={0}>
      {bookmarks.map((bookmark, index) => {
        return (
          <BookmarkRow
            key={bookmark.bookmarkId}
            bookmark={bookmark}
            archiveOriginal={archiveOriginal}
            exportingPublicId={exportingPublicId}
            onExport={onExport}
            withDivider={index > 0}
          />
        );
      })}
    </Stack>
  );
}

function useInstapaperControls() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [archiveOriginal, setArchiveOriginal] = useState(true);
  const [bookmarks, setBookmarks] = useState<InstapaperUnreadBookmark[]>(
    [],
  );
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [exportingPublicId, setExportingPublicId] = useState<
    string | null
  >(null);

  const loadUnread = trpc.listReaderInstapaperUnreadRoute.useMutation();
  const importUnread =
    trpc.importReaderInstapaperUnreadRoute.useMutation();
  const exportArticle =
    trpc.exportReaderArticleToInstapaperRoute.useMutation();

  const credentials = {
    username: username.trim(),
    password,
  };

  const validateCredentials = (): boolean => {
    if (!credentials.username || !credentials.password) {
      notifications.show({
        title: "Missing credentials",
        message: "Enter your Instapaper username and password.",
        color: "red",
      });
      return false;
    }

    return true;
  };

  const loadUnreadBookmarks = async (): Promise<void> => {
    if (!validateCredentials()) {
      return;
    }

    try {
      const result = await loadUnread.mutateAsync(credentials);
      setBookmarks(result.bookmarks);
      setSummary(null);
      setImportErrors([]);
      notifications.show({
        title: "Unread loaded",
        message: `${result.bookmarks.length} bookmark(s) loaded from Instapaper.`,
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Load failed",
        message: mutationErrorMessage(
          error,
          "Could not load unread Instapaper bookmarks.",
        ),
        color: "red",
      });
    }
  };

  const importUnreadBookmarks = async (): Promise<void> => {
    if (!validateCredentials()) {
      return;
    }

    try {
      const result = await importUnread.mutateAsync(credentials);
      setSummary(result.summary);
      setImportErrors(result.errors);
      setBookmarks(result.bookmarks);
      notifications.show({
        title: "Import complete",
        message: `${result.summary.imported} bookmark(s) queued for Reader ingest.`,
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Import failed",
        message: mutationErrorMessage(
          error,
          "Could not import unread Instapaper bookmarks.",
        ),
        color: "red",
      });
    }
  };

  const exportBookmark = async (
    bookmark: InstapaperUnreadBookmark,
  ): Promise<void> => {
    if (!validateCredentials()) {
      return;
    }

    const localArticle = bookmark.localArticle;
    if (!localArticle) {
      notifications.show({
        title: "No local article",
        message: "Import this bookmark to Koala before exporting.",
        color: "red",
      });
      return;
    }

    if (localArticle.ingestStatus !== "ready") {
      notifications.show({
        title: "Article not ready",
        message: "Wait for Reader ingest to complete before exporting.",
        color: "red",
      });
      return;
    }

    setExportingPublicId(localArticle.publicId);

    try {
      const result = await exportArticle.mutateAsync({
        ...credentials,
        publicId: localArticle.publicId,
        archiveOriginal,
        originalBookmarkId: bookmark.bookmarkId,
      });

      if (result.status === "exported_and_archived") {
        notifications.show({
          title: "Exported",
          message:
            "Korean article exported and original bookmark archived.",
          color: "green",
        });
      }

      if (result.status === "exported") {
        notifications.show({
          title: "Exported",
          message: "Korean article exported to Instapaper.",
          color: "green",
        });
      }

      if (result.status === "exported_archive_failed") {
        notifications.show({
          title: "Partial success",
          message:
            result.archiveError ||
            "Exported successfully, but archive failed.",
          color: "yellow",
        });
      }
    } catch (error: unknown) {
      notifications.show({
        title: "Export failed",
        message: mutationErrorMessage(
          error,
          "Could not export this article to Instapaper.",
        ),
        color: "red",
      });
    } finally {
      setExportingPublicId((current) => {
        if (current === localArticle.publicId) {
          return null;
        }

        return current;
      });
    }
  };

  return {
    username,
    password,
    archiveOriginal,
    bookmarks,
    summary,
    importErrors,
    exportingPublicId,
    isLoadingUnread: loadUnread.isLoading,
    isImportingUnread: importUnread.isLoading,
    onUsernameChange: setUsername,
    onPasswordChange: setPassword,
    onArchiveOriginalChange: setArchiveOriginal,
    onLoadUnread: loadUnreadBookmarks,
    onImportUnread: importUnreadBookmarks,
    onExportBookmark: exportBookmark,
  };
}

export default function ReaderInstapaperPage() {
  const controls = useInstapaperControls();

  return (
    <Container size="lg" mt="xl" pb="xl">
      <Stack gap="lg" style={pageShellStyle}>
        <PageHeader />
        <CredentialsPanel
          username={controls.username}
          password={controls.password}
          archiveOriginal={controls.archiveOriginal}
          loading={controls.isLoadingUnread}
          importing={controls.isImportingUnread}
          onUsernameChange={controls.onUsernameChange}
          onPasswordChange={controls.onPasswordChange}
          onArchiveOriginalChange={controls.onArchiveOriginalChange}
          onLoadUnread={controls.onLoadUnread}
          onImportUnread={controls.onImportUnread}
        />
        <ImportSummaryPanel
          summary={controls.summary}
          errors={controls.importErrors}
        />
        <BookmarkList
          bookmarks={controls.bookmarks}
          archiveOriginal={controls.archiveOriginal}
          exportingPublicId={controls.exportingPublicId}
          onExport={controls.onExportBookmark}
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
