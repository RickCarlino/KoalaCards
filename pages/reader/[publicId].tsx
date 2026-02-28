import { prismaClient } from "@/koala/prisma-client";
import {
  ReaderPageFrame,
  ReaderPageHeader,
  ReaderPanel,
} from "@/koala/reader/ui/layout";
import {
  formatReaderDateTime,
  readerBodyFont,
  readerDisplayFont,
  readerIngestLabel,
  readerIngestTone,
} from "@/koala/reader/ui/theme";
import { Anchor, Badge, Group, Stack, Text } from "@mantine/core";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import Link from "next/link";
import React, { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { IconExternalLink } from "@tabler/icons-react";

type PublicReaderArticle = {
  title: string;
  normalizedUrl: string;
  contentText: string;
  ingestStatus: "pending" | "in_progress" | "ready" | "error";
  ingestError: string;
  createdAt: Date;
};

function normalizeMarkdownText(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      return lines.join(" ");
    })
    .filter((paragraph) => paragraph.length > 0);

  return paragraphs.join("\n\n");
}

function pendingMessage(status: "pending" | "in_progress"): string {
  if (status === "pending") {
    return "This article is queued for processing.";
  }

  return "This article is currently being processed.";
}

type ArticleHeaderCardProps = {
  article: PublicReaderArticle;
};

function ArticleHeaderCard({ article }: ArticleHeaderCardProps) {
  const statusLabel = readerIngestLabel(article.ingestStatus);
  const statusTone = readerIngestTone(article.ingestStatus);

  return (
    <ReaderPanel>
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Anchor component={Link} href="/reader" size="sm">
          ← Back to Reader
        </Anchor>
        <Anchor
          href={article.normalizedUrl}
          target="_blank"
          rel="noreferrer"
          size="sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          Source
          <IconExternalLink size={14} stroke={1.8} />
        </Anchor>
      </Group>
      <Stack gap={6}>
        <Text
          style={{
            fontFamily: readerDisplayFont,
            fontSize: "clamp(1.35rem, 3vw, 2rem)",
            color: "#4b2f3f",
            lineHeight: 1.25,
            fontWeight: 700,
          }}
        >
          {article.title}
        </Text>
        <Group gap={6} wrap="wrap">
          <Badge color={statusTone} variant="light">
            {statusLabel}
          </Badge>
          <Text
            size="xs"
            c="dimmed"
            style={{ fontFamily: readerBodyFont }}
          >
            Added {formatReaderDateTime(article.createdAt)}
          </Text>
        </Group>
      </Stack>
    </ReaderPanel>
  );
}

function ProcessingCard({
  status,
  ingestError,
}: {
  status: PublicReaderArticle["ingestStatus"];
  ingestError: string;
}) {
  if (status === "ready") {
    return null;
  }

  if (status === "error") {
    return (
      <ReaderPanel>
        <Stack gap="xs">
          <Text c="red" fw={700}>
            This article could not be prepared.
          </Text>
          {ingestError.trim().length > 0 && (
            <Text size="sm" c="red">
              {ingestError}
            </Text>
          )}
          <Text size="sm" c="dimmed">
            Go back to Reader and submit the URL again after checking the
            source.
          </Text>
        </Stack>
      </ReaderPanel>
    );
  }

  return (
    <ReaderPanel>
      <Stack gap="xs">
        <Text c="dimmed">{pendingMessage(status)}</Text>
        <Text size="sm" c="dimmed">
          This page refreshes every 8 seconds while processing.
        </Text>
      </Stack>
    </ReaderPanel>
  );
}

function ArticleMarkdown({ markdownText }: { markdownText: string }) {
  if (!markdownText.trim()) {
    return (
      <ReaderPanel>
        <Text size="sm" c="dimmed">
          Article text is unavailable.
        </Text>
      </ReaderPanel>
    );
  }

  return (
    <ReaderPanel>
      <article
        style={{
          maxWidth: "92ch",
          margin: "0 auto",
          fontFamily: readerDisplayFont,
          lineHeight: 1.9,
          fontSize: "1.08rem",
          color: "#4f3342",
        }}
      >
        <ReactMarkdown>{markdownText}</ReactMarkdown>
      </article>
    </ReaderPanel>
  );
}

export default function PublicReaderArticlePage({
  article,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const markdownText = normalizeMarkdownText(article.contentText);
  const shouldAutoRefresh =
    article.ingestStatus === "pending" ||
    article.ingestStatus === "in_progress";

  useEffect(() => {
    if (!shouldAutoRefresh) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.location.reload();
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldAutoRefresh]);

  const showProcessingState = article.ingestStatus !== "ready";

  return (
    <ReaderPageFrame>
      <ReaderPageHeader
        title="Reading View"
        subtitle="Focused, clean prose with Korean-friendly formatting."
      />
      <ArticleHeaderCard article={article} />
      {showProcessingState && (
        <ProcessingCard
          status={article.ingestStatus}
          ingestError={article.ingestError}
        />
      )}
      {!showProcessingState && (
        <ArticleMarkdown markdownText={markdownText} />
      )}
    </ReaderPageFrame>
  );
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

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const publicId = context.params?.publicId;
  if (typeof publicId !== "string" || publicId.trim().length === 0) {
    return { notFound: true };
  }

  const article = await prismaClient.readerArticle.findUnique({
    where: { publicId },
    select: {
      title: true,
      normalizedUrl: true,
      contentText: true,
      ingestStatus: true,
      ingestError: true,
      createdAt: true,
    },
  });

  if (!article) {
    return { notFound: true };
  }

  const payload: PublicReaderArticle = {
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    contentText: article.contentText,
    ingestStatus: mapIngestStatus(article.ingestStatus),
    ingestError: article.ingestError,
    createdAt: article.createdAt,
  };

  return {
    props: {
      article: payload,
    },
  };
}
