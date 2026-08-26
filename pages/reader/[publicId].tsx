import { prismaClient } from "@/koala/prisma-client";
import { DEFAULT_READER_PREFERENCES } from "@/koala/reader/preferences";
import {
  ReaderArticlePage,
  type ReaderArticlePageData,
} from "@/koala/reader/ui/article-reader";
import type { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";

function mapIngestStatus(
  status: "PENDING" | "IN_PROGRESS" | "READY" | "ERROR",
): ReaderArticlePageData["ingestStatus"] {
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

async function recordOwnedReaderArticleRead(options: {
  publicId: string;
  ownerId: string;
  viewerId?: string;
  ingestStatus: "PENDING" | "IN_PROGRESS" | "READY" | "ERROR";
}): Promise<void> {
  if (
    options.viewerId !== options.ownerId ||
    options.ingestStatus !== "READY"
  ) {
    return;
  }

  await prismaClient.readerArticle.updateMany({
    where: {
      publicId: options.publicId,
      userId: options.ownerId,
    },
    data: { lastReadAt: new Date() },
  });
}

async function loadReaderArticle(publicId: string) {
  return prismaClient.readerArticle.findUnique({
    where: { publicId },
    select: {
      userId: true,
      publicId: true,
      title: true,
      normalizedUrl: true,
      inputKind: true,
      contentText: true,
      ingestStatus: true,
      ingestError: true,
      readAt: true,
      createdAt: true,
      user: {
        select: {
          userSettings: {
            select: {
              readerFontSize: true,
              readerLineHeight: true,
              readerReadingWidth: true,
            },
          },
        },
      },
    },
  });
}

async function findViewerId(email?: string | null) {
  if (!email) {
    return undefined;
  }
  const viewer = await prismaClient.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return viewer?.id;
}

function buildReaderArticlePayload(
  article: NonNullable<Awaited<ReturnType<typeof loadReaderArticle>>>,
  viewerId?: string,
): ReaderArticlePageData {
  const viewerIsOwner = viewerId === article.userId;
  const ownerPreferences = article.user.userSettings;
  const initialPreferences =
    viewerIsOwner && ownerPreferences
      ? {
          fontSize: ownerPreferences.readerFontSize,
          lineHeight: ownerPreferences.readerLineHeight,
          readingWidth: ownerPreferences.readerReadingWidth,
        }
      : DEFAULT_READER_PREFERENCES;

  return {
    publicId: article.publicId,
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    inputKind: article.inputKind === "RAW" ? "raw" : "url",
    contentText: article.contentText,
    ingestStatus: mapIngestStatus(article.ingestStatus),
    ingestError: article.ingestError,
    readAt: article.readAt?.toISOString() ?? null,
    createdAt: article.createdAt.toISOString(),
    viewerIsOwner,
    initialPreferences,
  };
}

export default ReaderArticlePage;

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const publicId = context.params?.publicId;
  if (typeof publicId !== "string" || !publicId.trim()) {
    return { notFound: true };
  }

  const [article, session] = await Promise.all([
    loadReaderArticle(publicId),
    getSession({ req: context.req }),
  ]);
  if (!article) {
    return { notFound: true };
  }

  const viewerId = await findViewerId(session?.user?.email);
  await recordOwnedReaderArticleRead({
    publicId: article.publicId,
    ownerId: article.userId,
    viewerId,
    ingestStatus: article.ingestStatus,
  });
  const payload = buildReaderArticlePayload(article, viewerId);

  return { props: { article: payload } };
}
