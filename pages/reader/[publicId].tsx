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

export default ReaderArticlePage;

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const publicId = context.params?.publicId;
  if (typeof publicId !== "string" || !publicId.trim()) {
    return { notFound: true };
  }

  const [article, session] = await Promise.all([
    prismaClient.readerArticle.findUnique({
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
    }),
    getSession({ req: context.req }),
  ]);
  if (!article) {
    return { notFound: true };
  }

  const viewer = session?.user?.email
    ? await prismaClient.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
    : null;
  const viewerIsOwner = viewer?.id === article.userId;
  await recordOwnedReaderArticleRead({
    publicId: article.publicId,
    ownerId: article.userId,
    viewerId: viewer?.id,
    ingestStatus: article.ingestStatus,
  });
  const ownerPreferences = article.user.userSettings;
  const initialPreferences =
    viewerIsOwner && ownerPreferences
      ? {
          fontSize: ownerPreferences.readerFontSize,
          lineHeight: ownerPreferences.readerLineHeight,
          readingWidth: ownerPreferences.readerReadingWidth,
        }
      : DEFAULT_READER_PREFERENCES;
  const payload: ReaderArticlePageData = {
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

  return { props: { article: payload } };
}
