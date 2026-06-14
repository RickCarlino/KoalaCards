import React from "react";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import { prismaClient } from "@/koala/prisma-client";
import {
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  fmtShortDate,
  requireAdminRequest,
  yesNo,
} from "@/koala/admin-helpers";

type OverviewCounts = {
  cardsTotal: number;
  cardsStudied: number;
  cardsPaused: number;
  deckCount: number;
  writingCount: number;
  quizResultCount: number;
  readerArticleCount: number;
  readerReadCount: number;
  readerHighlightCount: number;
  readerImportedHighlightCount: number;
};

type RecentWriting = {
  id: number;
  prompt: string;
  createdAt: string;
  submissionCharacterCount: number;
};

type RecentQuiz = {
  id: number;
  createdAt: string;
  definition: string;
  userInput: string;
  isAcceptable: boolean;
};

type RecentReaderArticle = {
  id: number;
  title: string;
  createdAt: string;
  readAt: string | null;
};

type RecentReaderHighlight = {
  id: number;
  articleTitle: string;
  selectedText: string;
  createdAt: string;
  importedAt: string | null;
};

function firstQueryParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isDeleteIntent(
  method: string | undefined,
  intent: string | string[] | undefined,
): boolean {
  if (method !== "POST") {
    return false;
  }
  return firstQueryParam(intent) === "delete";
}

function resolveDeleteError(
  error: string | string[] | undefined,
): string | null {
  if (firstQueryParam(error) === "self-delete") {
    return "Admins cannot delete themselves.";
  }
  return null;
}

async function maybeDeleteLinkedUser(options: {
  method: string | undefined;
  intent: string | string[] | undefined;
  viewerEmail: string | null;
  userId: string;
}) {
  if (!isDeleteIntent(options.method, options.intent)) {
    return null;
  }

  const currentUser = options.viewerEmail
    ? await prismaClient.user.findUnique({
        where: { email: options.viewerEmail },
      })
    : null;
  if (currentUser?.id === options.userId) {
    return {
      redirect: {
        destination: `/link/${options.userId}?error=self-delete`,
        permanent: false,
      },
    };
  }

  await prismaClient.user.delete({ where: { id: options.userId } });
  return {
    redirect: { destination: "/admin", permanent: false },
  };
}

function mapRecentWritingRows(
  rows: {
    id: number;
    prompt: string;
    createdAt: Date;
    submissionCharacterCount: number;
  }[],
): RecentWriting[] {
  return rows.map((writing) => ({
    id: writing.id,
    prompt: writing.prompt,
    createdAt: writing.createdAt.toISOString(),
    submissionCharacterCount: writing.submissionCharacterCount,
  }));
}

function mapRecentQuizRows(
  rows: {
    id: number;
    createdAt: Date;
    definition: string;
    userInput: string;
    isAcceptable: boolean;
  }[],
): RecentQuiz[] {
  return rows.map((quiz) => ({
    id: quiz.id,
    createdAt: quiz.createdAt.toISOString(),
    definition: quiz.definition,
    userInput: quiz.userInput,
    isAcceptable: quiz.isAcceptable,
  }));
}

function mapRecentReaderArticleRows(
  rows: {
    id: number;
    title: string;
    createdAt: Date;
    readAt: Date | null;
  }[],
): RecentReaderArticle[] {
  return rows.map((article) => ({
    id: article.id,
    title: article.title,
    createdAt: article.createdAt.toISOString(),
    readAt: article.readAt ? article.readAt.toISOString() : null,
  }));
}

function mapRecentReaderHighlightRows(
  rows: {
    id: number;
    selectedText: string;
    createdAt: Date;
    importedAt: Date | null;
    article: { title: string };
  }[],
): RecentReaderHighlight[] {
  return rows.map((highlight) => ({
    id: highlight.id,
    articleTitle: highlight.article.title,
    selectedText: highlight.selectedText,
    createdAt: highlight.createdAt.toISOString(),
    importedAt: highlight.importedAt
      ? highlight.importedAt.toISOString()
      : null,
  }));
}

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const adminRequest = await requireAdminRequest(context);
  if ("redirect" in adminRequest) {
    return adminRequest;
  }

  const userId = context.params?.userID as string | undefined;
  if (!userId) {
    return { notFound: true };
  }

  const deleteRedirect = await maybeDeleteLinkedUser({
    method: context.req.method,
    intent: context.query.intent,
    viewerEmail: adminRequest.email,
    userId,
  });
  if (deleteRedirect) {
    return deleteRedirect;
  }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      lastSeen: true,
    },
  });

  if (!user) {
    return { notFound: true };
  }

  const [
    cardsTotal,
    cardsStudied,
    cardsPaused,
    deckCount,
    writingCount,
    quizResultCount,
    readerArticleCount,
    readerReadCount,
    readerHighlightCount,
    readerImportedHighlightCount,
    recentWritingRows,
    recentQuizRows,
    recentReaderArticleRows,
    recentReaderHighlightRows,
  ] = await Promise.all([
    prismaClient.card.count({ where: { userId } }),
    prismaClient.card.count({ where: { userId, repetitions: { gt: 0 } } }),
    prismaClient.card.count({ where: { userId, paused: true } }),
    prismaClient.deck.count({ where: { userId } }),
    prismaClient.writingSubmission.count({ where: { userId } }),
    prismaClient.quizResult.count({ where: { userId } }),
    prismaClient.readerArticle.count({ where: { userId } }),
    prismaClient.readerArticle.count({
      where: { userId, readAt: { not: null } },
    }),
    prismaClient.readerArticleHighlight.count({ where: { userId } }),
    prismaClient.readerArticleHighlight.count({
      where: { userId, importedAt: { not: null } },
    }),
    prismaClient.writingSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        prompt: true,
        createdAt: true,
        submissionCharacterCount: true,
      },
    }),
    prismaClient.quizResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        definition: true,
        userInput: true,
        isAcceptable: true,
      },
    }),
    prismaClient.readerArticle.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        createdAt: true,
        readAt: true,
      },
    }),
    prismaClient.readerArticleHighlight.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        selectedText: true,
        createdAt: true,
        importedAt: true,
        article: {
          select: {
            title: true,
          },
        },
      },
    }),
  ]);

  const counts: OverviewCounts = {
    cardsTotal,
    cardsStudied,
    cardsPaused,
    deckCount,
    writingCount,
    quizResultCount,
    readerArticleCount,
    readerReadCount,
    readerHighlightCount,
    readerImportedHighlightCount,
  };

  const recentWriting = mapRecentWritingRows(recentWritingRows);
  const recentQuiz = mapRecentQuizRows(recentQuizRows);
  const recentReaderArticles = mapRecentReaderArticleRows(
    recentReaderArticleRows,
  );
  const recentReaderHighlights = mapRecentReaderHighlightRows(
    recentReaderHighlightRows,
  );

  return {
    props: {
      user: {
        id: user.id,
        email: user.email ?? "(no email)",
        name: user.name ?? null,
        createdAt: user.createdAt.toISOString(),
        lastSeen: user.lastSeen ? user.lastSeen.toISOString() : null,
      },
      error: resolveDeleteError(context.query.error),
      counts,
      recentWriting,
      recentQuiz,
      recentReaderArticles,
      recentReaderHighlights,
    },
  };
}

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

function fmtShort(iso: string | null): string {
  return fmtShortDate(iso, "—");
}

export default function UserOverviewPage({
  user,
  error,
  counts,
  recentWriting,
  recentQuiz,
  recentReaderArticles,
  recentReaderHighlights,
}: Props) {
  function onConfirmDelete(e: React.FormEvent<HTMLFormElement>) {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Delete this user and all related data? This cannot be undone.",
      );
      if (!ok) {
        e.preventDefault();
      }
    }
  }
  return (
    <Container size="lg" mt="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>User Overview</Title>
            <Text size="sm" c="dimmed">
              {user.email} {user.name ? `• ${user.name}` : ""}
            </Text>
            {error ? (
              <Text size="sm" c="red" mt="xs">
                {error}
              </Text>
            ) : null}
          </div>
          <form
            method="POST"
            action="?intent=delete"
            onSubmit={onConfirmDelete}
          >
            <Button color="red" variant="outline" type="submit">
              Delete User
            </Button>
          </form>
        </Group>

        <Group align="stretch">
          <Paper withBorder p="md" radius="md" style={{ flex: 1 }}>
            <Title order={4}>Profile</Title>
            <Table mt="sm">
              <tbody>
                <tr>
                  <td>Email</td>
                  <td>{user.email}</td>
                </tr>
                <tr>
                  <td>Created</td>
                  <td>{fmtShort(user.createdAt)}</td>
                </tr>
                <tr>
                  <td>Last Seen</td>
                  <td>{fmtShort(user.lastSeen)}</td>
                </tr>
              </tbody>
            </Table>
          </Paper>

          <Paper withBorder p="md" radius="md" style={{ flex: 1 }}>
            <Title order={4}>Counts</Title>
            <Table mt="sm">
              <tbody>
                <tr>
                  <td>Cards</td>
                  <td>{counts.cardsTotal}</td>
                </tr>
                <tr>
                  <td>Studied Cards</td>
                  <td>{counts.cardsStudied}</td>
                </tr>
                <tr>
                  <td>Paused Cards</td>
                  <td>{counts.cardsPaused}</td>
                </tr>
                <tr>
                  <td>Decks</td>
                  <td>{counts.deckCount}</td>
                </tr>
                <tr>
                  <td>Writing Submissions</td>
                  <td>{counts.writingCount}</td>
                </tr>
                <tr>
                  <td>Quiz Results</td>
                  <td>{counts.quizResultCount}</td>
                </tr>
                <tr>
                  <td>Reader Articles</td>
                  <td>{counts.readerArticleCount}</td>
                </tr>
                <tr>
                  <td>Read Articles</td>
                  <td>{counts.readerReadCount}</td>
                </tr>
                <tr>
                  <td>Reader Highlights</td>
                  <td>{counts.readerHighlightCount}</td>
                </tr>
                <tr>
                  <td>Imported Highlights</td>
                  <td>{counts.readerImportedHighlightCount}</td>
                </tr>
              </tbody>
            </Table>
          </Paper>
        </Group>

        <Paper withBorder p="md" radius="md">
          <Title order={4}>Recent Writing</Title>
          <Table striped highlightOnHover mt="sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Prompt</th>
                <th>Chars</th>
              </tr>
            </thead>
            <tbody>
              {recentWriting.length === 0 ? (
                <tr>
                  <td colSpan={3}>No writing yet</td>
                </tr>
              ) : (
                recentWriting.map((w) => (
                  <tr key={w.id}>
                    <td>{fmtShort(w.createdAt)}</td>
                    <td>{w.prompt}</td>
                    <td>{w.submissionCharacterCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Title order={4}>Recent Quiz</Title>
          <Table striped highlightOnHover mt="sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Definition</th>
                <th>Input</th>
                <th>Accepted</th>
              </tr>
            </thead>
            <tbody>
              {recentQuiz.length === 0 ? (
                <tr>
                  <td colSpan={4}>No quiz results yet</td>
                </tr>
              ) : (
                recentQuiz.map((q) => (
                  <tr key={q.id}>
                    <td>{fmtShort(q.createdAt)}</td>
                    <td>{q.definition}</td>
                    <td>{q.userInput}</td>
                    <td>{yesNo(q.isAcceptable)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Title order={4}>Recent Reader Articles</Title>
          <Table striped highlightOnHover mt="sm">
            <thead>
              <tr>
                <th>Added</th>
                <th>Title</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {recentReaderArticles.length === 0 ? (
                <tr>
                  <td colSpan={3}>No reader articles yet</td>
                </tr>
              ) : (
                recentReaderArticles.map((article) => (
                  <tr key={article.id}>
                    <td>{fmtShort(article.createdAt)}</td>
                    <td>
                      <Text size="sm" lineClamp={2} maw={360}>
                        {article.title}
                      </Text>
                    </td>
                    <td>{fmtShort(article.readAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Title order={4}>Recent Reader Highlights</Title>
          <Table striped highlightOnHover mt="sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Article</th>
                <th>Text</th>
                <th>Imported</th>
              </tr>
            </thead>
            <tbody>
              {recentReaderHighlights.length === 0 ? (
                <tr>
                  <td colSpan={4}>No reader highlights yet</td>
                </tr>
              ) : (
                recentReaderHighlights.map((highlight) => (
                  <tr key={highlight.id}>
                    <td>{fmtShort(highlight.createdAt)}</td>
                    <td>
                      <Text size="sm" lineClamp={2} maw={280}>
                        {highlight.articleTitle}
                      </Text>
                    </td>
                    <td>
                      <Text size="sm" lineClamp={2} maw={320}>
                        {highlight.selectedText}
                      </Text>
                    </td>
                    <td>{fmtShort(highlight.importedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Paper>
      </Stack>
    </Container>
  );
}
