import { prismaClient } from "@/koala/prisma-client";
import {
  Anchor,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import Link from "next/link";
import React from "react";
import ReactMarkdown from "react-markdown";
import { IconExternalLink } from "@tabler/icons-react";

type PublicReaderArticle = {
  title: string;
  normalizedUrl: string;
  contentText: string;
};

const headlineFont =
  '"Palatino Linotype", "Book Antiqua", Palatino, serif';

const articleHeaderStyle: React.CSSProperties = {
  borderBottom: "1px solid #f0dce7",
  paddingBottom: "clamp(10px, 1.5vw, 14px)",
};

const proseStyle: React.CSSProperties = {
  maxWidth: "92ch",
  margin: "0 auto",
  fontFamily: headlineFont,
  lineHeight: 1.9,
  fontSize: "1.08rem",
  color: "#4f3342",
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

type MarkdownArticleProps = {
  markdownText: string;
};

function MarkdownArticle({ markdownText }: MarkdownArticleProps) {
  if (!markdownText.trim()) {
    return (
      <Text size="sm" c="dimmed">
        Article text is unavailable.
      </Text>
    );
  }

  return (
    <article style={proseStyle}>
      <ReactMarkdown>{markdownText}</ReactMarkdown>
    </article>
  );
}

type ArticleHeaderProps = {
  article: PublicReaderArticle;
};

function ArticleHeader({ article }: ArticleHeaderProps) {
  return (
    <Stack gap="sm" style={articleHeaderStyle}>
      <Group justify="space-between" align="center" wrap="wrap">
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
      <Title
        order={1}
        style={{
          fontFamily: headlineFont,
          lineHeight: 1.24,
          color: "#4a2f3f",
        }}
      >
        {article.title}
      </Title>
    </Stack>
  );
}

export default function PublicReaderArticlePage({
  article,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const markdownText = normalizeMarkdownText(article.contentText);

  return (
    <Container size="lg" mt="sm" pb="xl">
      <Stack gap="lg">
        <ArticleHeader article={article} />
        <MarkdownArticle markdownText={markdownText} />
      </Stack>
    </Container>
  );
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
    },
  });

  if (!article) {
    return { notFound: true };
  }

  const payload: PublicReaderArticle = {
    title: article.title,
    normalizedUrl: article.normalizedUrl,
    contentText: article.contentText,
  };

  return {
    props: {
      article: payload,
    },
  };
}
