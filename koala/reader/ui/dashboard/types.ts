export type ReaderArticleSummary = {
  id: number;
  publicId: string;
  title: string;
  normalizedUrl: string | null;
  inputKind: "url" | "raw";
  description: string;
  ingestStatus: "pending" | "in_progress" | "ready" | "error";
  ingestError: string;
  readAt: Date | null;
  createdAt: Date;
};

export type ReaderDashboardStats = {
  queued: number;
  processing: number;
  ready: number;
  errored: number;
};

export type ReaderReadFilter = "unread" | "read" | "all";
