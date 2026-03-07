import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { trpc } from "@/koala/trpc-config";
import type { ImportSummary, InstapaperUnreadBookmark } from "./types";

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

type ExportEligibility =
  | {
      eligible: true;
      localArticle: NonNullable<InstapaperUnreadBookmark["localArticle"]>;
    }
  | {
      eligible: false;
      reason: "missing_local_article" | "not_ready";
    };

type ExportExecutionResult =
  | {
      status:
        | "exported"
        | "exported_and_archived"
        | "exported_archive_failed";
      message: string | null;
    }
  | {
      status: "failed" | "skipped";
      message: string;
    };

type BulkExportStats = {
  exported: number;
  archived: number;
  archiveFailed: number;
  failed: number;
  firstIssue: string | null;
};

const emptyBulkExportStats = (): BulkExportStats => {
  return {
    exported: 0,
    archived: 0,
    archiveFailed: 0,
    failed: 0,
    firstIssue: null,
  };
};

const updateBulkExportStats = (
  stats: BulkExportStats,
  result: ExportExecutionResult,
): BulkExportStats => {
  const next = { ...stats };

  if (
    result.status === "exported" ||
    result.status === "exported_and_archived" ||
    result.status === "exported_archive_failed"
  ) {
    next.exported += 1;
  }

  if (result.status === "exported_and_archived") {
    next.archived += 1;
  }

  if (result.status === "exported_archive_failed") {
    next.archiveFailed += 1;

    if (!next.firstIssue && result.message) {
      next.firstIssue = result.message;
    }
  }

  if (result.status === "failed") {
    next.failed += 1;

    if (!next.firstIssue) {
      next.firstIssue = result.message;
    }
  }

  return next;
};

const exportEligibility = (
  bookmark: InstapaperUnreadBookmark,
): ExportEligibility => {
  if (!bookmark.localArticle) {
    return {
      eligible: false,
      reason: "missing_local_article",
    };
  }

  if (bookmark.localArticle.ingestStatus !== "ready") {
    return {
      eligible: false,
      reason: "not_ready",
    };
  }

  return {
    eligible: true,
    localArticle: bookmark.localArticle,
  };
};

const isExportableBookmark = (
  bookmark: InstapaperUnreadBookmark,
): boolean => {
  return exportEligibility(bookmark).eligible;
};

const ineligibleExportNotice = (
  reason: "missing_local_article" | "not_ready",
) => {
  if (reason === "missing_local_article") {
    return {
      title: "No local article",
      message: "Import this bookmark to Koala before exporting.",
    };
  }

  return {
    title: "Article not ready",
    message: "Wait until the article is ready, then export.",
  };
};

export function useInstapaperControls() {
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
  const [isExportingAll, setIsExportingAll] = useState(false);

  const connectionQuery = trpc.getReaderInstapaperConnectionRoute.useQuery(
    {},
    {
      refetchOnWindowFocus: false,
    },
  );
  const connectInstapaper =
    trpc.connectReaderInstapaperRoute.useMutation();
  const disconnectInstapaper =
    trpc.disconnectReaderInstapaperRoute.useMutation();
  const loadUnread = trpc.listReaderInstapaperUnreadRoute.useMutation();
  const importUnread =
    trpc.importReaderInstapaperUnreadRoute.useMutation();
  const exportArticle =
    trpc.exportReaderArticleToInstapaperRoute.useMutation();

  const isConnected = Boolean(connectionQuery.data?.connected);

  const requireConnection = (): boolean => {
    if (!isConnected) {
      notifications.show({
        title: "Not connected",
        message:
          "Connect Instapaper before loading, importing, or exporting.",
        color: "red",
      });
      return false;
    }

    return true;
  };

  const connect = async (): Promise<void> => {
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      notifications.show({
        title: "Missing credentials",
        message: "Enter your Instapaper username and password.",
        color: "red",
      });
      return;
    }

    try {
      await connectInstapaper.mutateAsync({
        username: trimmedUsername,
        password,
      });
      setPassword("");
      await connectionQuery.refetch();
      notifications.show({
        title: "Connected",
        message: "Instapaper connected.",
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Connect failed",
        message: mutationErrorMessage(
          error,
          "Could not connect to Instapaper.",
        ),
        color: "red",
      });
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      await disconnectInstapaper.mutateAsync({});
      setBookmarks([]);
      setSummary(null);
      setImportErrors([]);
      setExportingPublicId(null);
      setIsExportingAll(false);
      await connectionQuery.refetch();
      notifications.show({
        title: "Disconnected",
        message: "Instapaper connection removed.",
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Disconnect failed",
        message: mutationErrorMessage(
          error,
          "Could not disconnect Instapaper.",
        ),
        color: "red",
      });
    }
  };

  const loadUnreadBookmarks = async (): Promise<void> => {
    if (!requireConnection()) {
      return;
    }

    try {
      const result = await loadUnread.mutateAsync({});
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
          "Couldn't load unread Instapaper bookmarks.",
        ),
        color: "red",
      });
    }
  };

  const importUnreadBookmarks = async (): Promise<void> => {
    if (!requireConnection()) {
      return;
    }

    try {
      const result = await importUnread.mutateAsync({});
      setSummary(result.summary);
      setImportErrors(result.errors);
      setBookmarks(result.bookmarks);
      notifications.show({
        title: "Import complete",
        message: `${result.summary.imported} bookmark(s) added to Reader.`,
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Import failed",
        message: mutationErrorMessage(
          error,
          "Couldn't import unread Instapaper bookmarks.",
        ),
        color: "red",
      });
    }
  };

  const exportBookmarkInternal = async (
    bookmark: InstapaperUnreadBookmark,
    notify: boolean,
  ): Promise<ExportExecutionResult> => {
    const eligibility = exportEligibility(bookmark);

    if (!eligibility.eligible) {
      const notice = ineligibleExportNotice(eligibility.reason);

      if (notify) {
        notifications.show({
          title: notice.title,
          message: notice.message,
          color: "red",
        });
      }

      return {
        status: "skipped",
        message: notice.message,
      };
    }

    const localArticle = eligibility.localArticle;
    setExportingPublicId(localArticle.publicId);

    try {
      const result = await exportArticle.mutateAsync({
        publicId: localArticle.publicId,
        archiveOriginal,
        originalBookmarkId: bookmark.bookmarkId,
      });

      if (notify && result.status === "exported_and_archived") {
        notifications.show({
          title: "Exported",
          message: "Article exported and original bookmark archived.",
          color: "green",
        });
      }

      if (notify && result.status === "exported") {
        notifications.show({
          title: "Exported",
          message: "Article exported to Instapaper.",
          color: "green",
        });
      }

      if (notify && result.status === "exported_archive_failed") {
        notifications.show({
          title: "Partial success",
          message:
            result.archiveError ||
            "Exported, but archiving the original bookmark failed.",
          color: "yellow",
        });
      }

      return {
        status: result.status,
        message: result.archiveError || null,
      };
    } catch (error: unknown) {
      const message = mutationErrorMessage(
        error,
        "Could not export this article to Instapaper.",
      );

      if (notify) {
        notifications.show({
          title: "Export failed",
          message,
          color: "red",
        });
      }

      return {
        status: "failed",
        message,
      };
    } finally {
      setExportingPublicId((current) => {
        if (current === localArticle.publicId) {
          return null;
        }

        return current;
      });
    }
  };

  const exportBookmark = async (
    bookmark: InstapaperUnreadBookmark,
  ): Promise<void> => {
    if (!requireConnection()) {
      return;
    }

    if (isExportingAll) {
      notifications.show({
        title: "Export all in progress",
        message:
          "Wait for bulk export to finish before exporting individual rows.",
        color: "yellow",
      });
      return;
    }

    await exportBookmarkInternal(bookmark, true);
  };

  const exportAllBookmarks = async (): Promise<void> => {
    if (!requireConnection()) {
      return;
    }

    if (isExportingAll) {
      notifications.show({
        title: "Export all in progress",
        message: "Bulk export is already running.",
        color: "yellow",
      });
      return;
    }

    const eligibleBookmarks = bookmarks.filter((bookmark) => {
      return isExportableBookmark(bookmark);
    });

    if (eligibleBookmarks.length === 0) {
      notifications.show({
        title: "Nothing to export",
        message: "No ready articles are available to export.",
        color: "yellow",
      });
      return;
    }

    let stats = emptyBulkExportStats();

    setIsExportingAll(true);

    try {
      for (const bookmark of eligibleBookmarks) {
        const result = await exportBookmarkInternal(bookmark, false);
        stats = updateBulkExportStats(stats, result);
      }
    } finally {
      setIsExportingAll(false);
    }

    const hasIssues = stats.archiveFailed > 0 || stats.failed > 0;
    const messageParts = [`${stats.exported} article(s) exported.`];

    if (archiveOriginal) {
      messageParts.push(
        `${stats.archived} original bookmark(s) archived.`,
      );
    }

    if (stats.archiveFailed > 0) {
      messageParts.push(
        `${stats.archiveFailed} archive attempt(s) failed.`,
      );
    }

    if (stats.failed > 0) {
      messageParts.push(`${stats.failed} export(s) failed.`);
    }

    if (stats.firstIssue) {
      messageParts.push(`First issue: ${stats.firstIssue}`);
    }

    notifications.show({
      title: hasIssues
        ? "Export all finished with issues"
        : "Export all complete",
      message: messageParts.join(" "),
      color: hasIssues ? "yellow" : "green",
    });
  };

  return {
    username,
    password,
    archiveOriginal,
    bookmarks,
    summary,
    importErrors,
    exportingPublicId,
    isExportingAll,
    connection: connectionQuery.data,
    isConnectionLoading: connectionQuery.isLoading,
    isConnecting: connectInstapaper.isLoading,
    isDisconnecting: disconnectInstapaper.isLoading,
    isLoadingUnread: loadUnread.isLoading,
    isImportingUnread: importUnread.isLoading,
    onUsernameChange: setUsername,
    onPasswordChange: setPassword,
    onArchiveOriginalChange: setArchiveOriginal,
    onConnect: connect,
    onDisconnect: disconnect,
    onLoadUnread: loadUnreadBookmarks,
    onImportUnread: importUnreadBookmarks,
    onExportBookmark: exportBookmark,
    onExportAllBookmarks: exportAllBookmarks,
  };
}
