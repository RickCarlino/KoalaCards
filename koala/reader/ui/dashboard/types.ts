export type ReaderArticleSummary = {
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

export type ReaderDashboardStats = {
  queued: number;
  processing: number;
  ready: number;
  errored: number;
};
