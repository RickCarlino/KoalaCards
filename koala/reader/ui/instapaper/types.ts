export type ReaderIngestStatus =
  "pending" | "in_progress" | "ready" | "error";

export type InstapaperConnectionStatus = {
  connected: boolean;
  username: string | null;
  updatedAt: Date | null;
};

export type InstapaperLocalArticle = {
  publicId: string;
  title: string;
  ingestStatus: ReaderIngestStatus;
  createdAt: Date;
  instapaperBookmarkId: string | null;
};

export type InstapaperUnreadBookmark = {
  bookmarkId: string;
  url: string;
  title: string;
  description: string;
  normalizedUrl: string | null;
  urlError: string | null;
  localArticle: InstapaperLocalArticle | null;
};

export type ImportSummary = {
  imported: number;
  duplicates: number;
  invalidUrls: number;
  failed: number;
};
