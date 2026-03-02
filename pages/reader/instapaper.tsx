import { getUserSettingsFromEmail } from "@/koala/auth-helpers";
import {
  ReaderPageFrame,
  ReaderPageHeader,
  ReaderPanel,
  ReaderPanelHeader,
} from "@/koala/reader/ui/layout";
import {
  formatReaderDateTime,
  readerHeadingColor,
  readerIngestLabel,
  readerIngestTone,
  readerListRowStyle,
} from "@/koala/reader/ui/theme";
import { useInstapaperControls } from "@/koala/reader/ui/instapaper/use-instapaper-controls";
import type {
  ImportSummary,
  InstapaperConnectionStatus,
  InstapaperUnreadBookmark,
} from "@/koala/reader/ui/instapaper/types";
import {
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { getSession } from "next-auth/react";
import React from "react";

function canExportBookmark(bookmark: InstapaperUnreadBookmark): boolean {
  if (!bookmark.localArticle) {
    return false;
  }

  return bookmark.localArticle.ingestStatus === "ready";
}

function exportableBookmarkCount(
  bookmarks: InstapaperUnreadBookmark[],
): number {
  let count = 0;

  for (const bookmark of bookmarks) {
    if (canExportBookmark(bookmark)) {
      count += 1;
    }
  }

  return count;
}

function bookmarkStatusText(bookmark: InstapaperUnreadBookmark): string {
  if (bookmark.urlError) {
    return bookmark.urlError;
  }

  if (!bookmark.localArticle) {
    return "Not imported into Koala yet.";
  }

  const article = bookmark.localArticle;
  return readerIngestLabel(article.ingestStatus);
}

type ConnectionPanelProps = {
  connection: InstapaperConnectionStatus | undefined;
  isConnectionLoading: boolean;
  username: string;
  password: string;
  archiveOriginal: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isLoadingUnread: boolean;
  isImportingUnread: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onArchiveOriginalChange: (value: boolean) => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onLoadUnread: () => Promise<void>;
  onImportUnread: () => Promise<void>;
};

function ConnectionPanel({
  connection,
  isConnectionLoading,
  username,
  password,
  archiveOriginal,
  isConnecting,
  isDisconnecting,
  isLoadingUnread,
  isImportingUnread,
  onUsernameChange,
  onPasswordChange,
  onArchiveOriginalChange,
  onConnect,
  onDisconnect,
  onLoadUnread,
  onImportUnread,
}: ConnectionPanelProps) {
  if (isConnectionLoading) {
    return (
      <ReaderPanel>
        <Text size="sm" c="dimmed">
          Checking Instapaper connection...
        </Text>
      </ReaderPanel>
    );
  }

  if (!connection?.connected) {
    return (
      <ReaderPanel>
        <ReaderPanelHeader
          title="Connect Instapaper"
          subtitle="Your password is used only to obtain access tokens. Koala stores encrypted tokens, not your password."
        />
        <Group align="flex-end" wrap="wrap" gap="xs">
          <TextInput
            label="Username"
            placeholder="you@example.com"
            value={username}
            onChange={(event) =>
              onUsernameChange(event.currentTarget.value)
            }
            style={{ flex: "1 1 220px" }}
          />
          <PasswordInput
            label="Password"
            placeholder="Instapaper password"
            value={password}
            onChange={(event) =>
              onPasswordChange(event.currentTarget.value)
            }
            style={{ flex: "1 1 220px" }}
          />
          <Button
            color="pink"
            loading={isConnecting}
            onClick={onConnect}
            style={{ minWidth: 108 }}
          >
            Connect
          </Button>
        </Group>
      </ReaderPanel>
    );
  }

  const usernameLabel = connection.username ?? "(unknown user)";
  const updatedAtLabel = connection.updatedAt
    ? formatReaderDateTime(connection.updatedAt)
    : "Unknown";

  return (
    <ReaderPanel>
      <ReaderPanelHeader
        title={`Connected as ${usernameLabel}`}
        subtitle={`Token updated: ${updatedAtLabel}`}
      />
      <Group gap="xs" wrap="wrap">
        <Button
          color="pink"
          loading={isLoadingUnread}
          onClick={onLoadUnread}
        >
          Load Unread
        </Button>
        <Button
          variant="light"
          color="pink"
          loading={isImportingUnread}
          onClick={onImportUnread}
        >
          Import Unread to Koala
        </Button>
        <Button
          variant="subtle"
          color="red"
          loading={isDisconnecting}
          onClick={onDisconnect}
        >
          Disconnect
        </Button>
      </Group>
      <Checkbox
        label="Archive original Instapaper bookmark after successful export"
        checked={archiveOriginal}
        onChange={(event) =>
          onArchiveOriginalChange(event.currentTarget.checked)
        }
      />
    </ReaderPanel>
  );
}

function ImportSummaryCard({
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
    <ReaderPanel>
      <ReaderPanelHeader title="Last Import Summary" />
      <Group gap={6} wrap="wrap">
        <Badge color="teal" variant="light">
          Imported {summary.imported}
        </Badge>
        <Badge color="yellow" variant="light">
          Duplicates {summary.duplicates}
        </Badge>
        <Badge color="gray" variant="light">
          Invalid URLs {summary.invalidUrls}
        </Badge>
        <Badge color="red" variant="light">
          Failed {summary.failed}
        </Badge>
      </Group>
      {errors.length > 0 && (
        <Stack gap={4}>
          {errors.map((errorMessage, index) => {
            return (
              <Text key={`${errorMessage}-${index}`} size="sm" c="red">
                {errorMessage}
              </Text>
            );
          })}
        </Stack>
      )}
    </ReaderPanel>
  );
}

type BookmarkRowProps = {
  bookmark: InstapaperUnreadBookmark;
  archiveOriginal: boolean;
  exportingPublicId: string | null;
  disableExport: boolean;
  onExport: (bookmark: InstapaperUnreadBookmark) => Promise<void>;
  withDivider: boolean;
};

function BookmarkRow({
  bookmark,
  archiveOriginal,
  exportingPublicId,
  disableExport,
  onExport,
  withDivider,
}: BookmarkRowProps) {
  const localArticle = bookmark.localArticle;
  const exportable = canExportBookmark(bookmark);
  const statusText = bookmarkStatusText(bookmark);
  const statusTone = localArticle
    ? readerIngestTone(localArticle.ingestStatus)
    : "gray";
  const isExporting =
    localArticle && exportingPublicId === localArticle.publicId;

  return (
    <Stack style={readerListRowStyle(withDivider)}>
      <Anchor
        href={bookmark.url}
        target="_blank"
        rel="noreferrer"
        style={{
          fontWeight: 700,
          color: readerHeadingColor,
          lineHeight: 1.35,
        }}
      >
        {bookmark.title}
      </Anchor>

      <Group gap={6} wrap="wrap">
        <Badge color={statusTone} variant="light" size="sm">
          {statusText}
        </Badge>
        {localArticle && (
          <Text size="xs" c="dimmed">
            Saved {formatReaderDateTime(localArticle.createdAt)}
          </Text>
        )}
      </Group>

      {bookmark.description.trim().length > 0 && (
        <Text size="sm" c="dimmed" lineClamp={1}>
          {bookmark.description}
        </Text>
      )}

      {localArticle && (
        <Group gap="xs" wrap="wrap">
          <Anchor
            component={Link}
            href={`/reader/${localArticle.publicId}`}
            size="xs"
          >
            Open in Koala
          </Anchor>
          {exportable && (
            <Button
              size="compact-sm"
              color="pink"
              loading={Boolean(isExporting)}
              disabled={disableExport}
              onClick={() => onExport(bookmark)}
            >
              Export Korean
            </Button>
          )}
          {exportable && (
            <Text size="xs" c="dimmed">
              {archiveOriginal
                ? "Archive original after export"
                : "Keep original unread bookmark"}
            </Text>
          )}
        </Group>
      )}
    </Stack>
  );
}

type BookmarksCardProps = {
  bookmarks: InstapaperUnreadBookmark[];
  archiveOriginal: boolean;
  exportingPublicId: string | null;
  isExportingAll: boolean;
  onExport: (bookmark: InstapaperUnreadBookmark) => Promise<void>;
  onExportAll: () => Promise<void>;
};

function BookmarksCard({
  bookmarks,
  archiveOriginal,
  exportingPublicId,
  isExportingAll,
  onExport,
  onExportAll,
}: BookmarksCardProps) {
  const exportableCount = exportableBookmarkCount(bookmarks);
  const exportAllLabel =
    exportableCount === 1
      ? "Export 1 Ready Article"
      : `Export ${exportableCount} Ready Articles`;

  return (
    <ReaderPanel>
      <ReaderPanelHeader
        title="Unread Bookmarks"
        subtitle={`${bookmarks.length} loaded`}
        rightSlot={
          <Button
            size="compact-sm"
            color="pink"
            variant="light"
            loading={isExportingAll}
            disabled={exportableCount === 0}
            onClick={onExportAll}
          >
            {exportAllLabel}
          </Button>
        }
      />

      {bookmarks.length === 0 && (
        <Text size="sm" c="dimmed">
          No unread bookmarks loaded yet.
        </Text>
      )}

      {bookmarks.length > 0 && (
        <Stack gap={0}>
          {bookmarks.map((bookmark, index) => {
            return (
              <BookmarkRow
                key={bookmark.bookmarkId}
                bookmark={bookmark}
                archiveOriginal={archiveOriginal}
                exportingPublicId={exportingPublicId}
                disableExport={isExportingAll}
                onExport={onExport}
                withDivider={index > 0}
              />
            );
          })}
        </Stack>
      )}
    </ReaderPanel>
  );
}

export default function ReaderInstapaperPage() {
  const controls = useInstapaperControls();

  return (
    <ReaderPageFrame>
      <ReaderPageHeader
        title="Instapaper"
        subtitle="Connect once, import unread bookmarks into your Reader shelf, then export polished Korean versions back to Instapaper."
        rightSlot={
          <Button
            component={Link}
            href="/reader"
            variant="light"
            size="sm"
          >
            Back to Reader
          </Button>
        }
      />

      <ConnectionPanel
        connection={controls.connection}
        isConnectionLoading={controls.isConnectionLoading}
        username={controls.username}
        password={controls.password}
        archiveOriginal={controls.archiveOriginal}
        isConnecting={controls.isConnecting}
        isDisconnecting={controls.isDisconnecting}
        isLoadingUnread={controls.isLoadingUnread}
        isImportingUnread={controls.isImportingUnread}
        onUsernameChange={controls.onUsernameChange}
        onPasswordChange={controls.onPasswordChange}
        onArchiveOriginalChange={controls.onArchiveOriginalChange}
        onConnect={controls.onConnect}
        onDisconnect={controls.onDisconnect}
        onLoadUnread={controls.onLoadUnread}
        onImportUnread={controls.onImportUnread}
      />

      <ImportSummaryCard
        summary={controls.summary}
        errors={controls.importErrors}
      />

      <BookmarksCard
        bookmarks={controls.bookmarks}
        archiveOriginal={controls.archiveOriginal}
        exportingPublicId={controls.exportingPublicId}
        isExportingAll={controls.isExportingAll}
        onExport={controls.onExportBookmark}
        onExportAll={controls.onExportAllBookmarks}
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
