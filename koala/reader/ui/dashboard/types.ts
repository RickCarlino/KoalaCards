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
  highlightCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ReaderDashboardStats = {
  queued: number;
  processing: number;
  ready: number;
  errored: number;
};
