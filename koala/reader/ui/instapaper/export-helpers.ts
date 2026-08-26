export type ExportEligibility =
  | {
      eligible: true;
      localArticle: {
        publicId: string;
        ingestStatus: string;
      };
    }
  | {
      eligible: false;
      reason: "missing_local_article" | "not_ready";
    };

export type ExportExecutionResult =
  | {
      status:
        "exported" | "exported_and_archived" | "exported_archive_failed";
      message: string | null;
    }
  | {
      status: "failed" | "skipped";
      message: string;
    };

export type BulkExportStats = {
  exported: number;
  archived: number;
  archiveFailed: number;
  failed: number;
  firstIssue: string | null;
};

export function emptyBulkExportStats(): BulkExportStats {
  return {
    exported: 0,
    archived: 0,
    archiveFailed: 0,
    failed: 0,
    firstIssue: null,
  };
}

export function updateBulkExportStats(
  stats: BulkExportStats,
  result: ExportExecutionResult,
): BulkExportStats {
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
}

export function exportEligibility(bookmark: {
  localArticle: {
    publicId: string;
    ingestStatus: string;
  } | null;
}): ExportEligibility {
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
}

export function isExportableBookmark(bookmark: {
  localArticle: {
    publicId: string;
    ingestStatus: string;
  } | null;
}): boolean {
  return exportEligibility(bookmark).eligible;
}

export function ineligibleExportNotice(
  reason: "missing_local_article" | "not_ready",
) {
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
}

export function buildExportResultNotification(
  result: ExportExecutionResult,
): {
  title: string;
  message: string;
  color: "green" | "yellow";
} | null {
  if (result.status === "exported_and_archived") {
    return {
      title: "Exported",
      message: "Article exported and original bookmark archived.",
      color: "green",
    };
  }

  if (result.status === "exported") {
    return {
      title: "Exported",
      message: "Article exported to Instapaper.",
      color: "green",
    };
  }

  if (result.status === "exported_archive_failed") {
    return {
      title: "Partial success",
      message:
        result.message ||
        "Exported, but archiving the original bookmark failed.",
      color: "yellow",
    };
  }

  return null;
}

export function buildBulkExportNotification(
  stats: BulkExportStats,
  archiveOriginal: boolean,
) {
  const hasIssues = stats.archiveFailed > 0 || stats.failed > 0;
  const messageParts = [`${stats.exported} article(s) exported.`];

  if (archiveOriginal) {
    messageParts.push(`${stats.archived} original bookmark(s) archived.`);
  }
  if (stats.archiveFailed > 0) {
    messageParts.push(`${stats.archiveFailed} archive attempt(s) failed.`);
  }
  if (stats.failed > 0) {
    messageParts.push(`${stats.failed} export(s) failed.`);
  }
  if (stats.firstIssue) {
    messageParts.push(`First issue: ${stats.firstIssue}`);
  }

  return {
    title: hasIssues
      ? "Export all finished with issues"
      : "Export all complete",
    message: messageParts.join(" "),
    color: hasIssues ? "yellow" : "green",
  } as const;
}
