import { prismaClient } from "../prisma-client";

export type ReaderInputKind = "url" | "raw";

export type PublicReaderArticle = {
  publicId: string;
  title: string;
  normalizedUrl: string | null;
  inputKind: ReaderInputKind;
  contentText: string;
  ingestStatus: "pending" | "in_progress" | "ready" | "error";
  ingestError: string;
  createdAt: string;
};

export function selectPendingMessage(
  status: "pending" | "in_progress",
  messages: {
    pending: string;
    inProgress: string;
  },
): string {
  if (status === "pending") {
    return messages.pending;
  }

  return messages.inProgress;
}

export function collapseReaderWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripReaderMarkdownSyntax(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~]/g, " ");
}

export function buildReaderSourceText(
  contentText: string,
  inputKind: ReaderInputKind,
): string {
  const normalized = contentText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  if (inputKind === "raw") {
    return normalized;
  }

  return stripReaderMarkdownSyntax(normalized);
}

function mapIngestStatus(
  status: "PENDING" | "IN_PROGRESS" | "READY" | "ERROR",
): PublicReaderArticle["ingestStatus"] {
  if (status === "PENDING") {
    return "pending";
  }

  if (status === "IN_PROGRESS") {
    return "in_progress";
  }

  if (status === "READY") {
    return "ready";
  }

  return "error";
}

function mapInputKind(value: "URL" | "RAW"): ReaderInputKind {
  if (value === "RAW") {
    return "raw";
  }

  return "url";
}

export async function getPublicReaderArticle(
  publicId: string,
): Promise<PublicReaderArticle | null> {
  const article = await prismaClient.readerArticle.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      title: true,
      normalizedUrl: true,
      inputKind: true,
      contentText: true,
      ingestStatus: true,
      ingestError: true,
      createdAt: true,
    },
  });

  if (!article) {
    return null;
  }

  return {
    publicId: article.publicId,
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    inputKind: mapInputKind(article.inputKind),
    contentText: article.contentText,
    ingestStatus: mapIngestStatus(article.ingestStatus),
    ingestError: article.ingestError,
    createdAt: article.createdAt.toISOString(),
  };
}
