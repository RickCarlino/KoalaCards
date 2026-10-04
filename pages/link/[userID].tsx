import React from "react";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import { prismaClient } from "@/koala/prisma-client";
import {
  combineReaderCounts,
  combineReaderHighlightActivity,
} from "@/koala/reader/activity";
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
  readerDocumentCount: number;
  readerBookCount: number;
  readerReadArticleCount: number;
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

type RecentReaderDocument = {
  key: string;
  kind: "Article" | "EPUB";
  title: string;
  createdAt: string;
  lastActivityAt: string | null;
};

type RecentReaderHighlight = {
  key: string;
  kind: "Article" | "EPUB";
  sourceTitle: string;
  chapterTitle: string;
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

function combineRecentReaderDocuments(options: {
  articles: {
    id: number;
    title: string;
    createdAt: Date;
    readAt: Date | null;
  }[];
  books: {
    id: number;
    title: string;
    createdAt: Date;
    progress: { lastOpenedAt: Date | null } | null;
  }[];
}): RecentReaderDocument[] {
  const articles = options.articles.map((article) => ({
    key: `article-${article.id}`,
    kind: "Article" as const,
    title: article.title,
    createdAt: article.createdAt,
    lastActivityAt: article.readAt,
  }));
  const books = options.books.map((book) => ({
    key: `book-${book.id}`,
    kind: "EPUB" as const,
    title: book.title,
    createdAt: book.createdAt,
    lastActivityAt: book.progress?.lastOpenedAt ?? null,
  }));

  return [...articles, ...books]
    .sort((left, right) => {
      return right.createdAt.getTime() - left.createdAt.getTime();
    })
    .slice(0, 10)
    .map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
      lastActivityAt: document.lastActivityAt?.toISOString() ?? null,
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
    readerBookCount,
    readerReadArticleCount,
    readerArticleHighlightCount,
    readerBookHighlightCount,
    readerImportedArticleHighlightCount,
    readerImportedBookHighlightCount,
    recentWritingRows,
    recentQuizRows,
    recentReaderArticleRows,
    recentReaderBookRows,
    recentReaderArticleHighlightRows,
    recentReaderBookHighlightRows,
  ] = await Promise.all([
    prismaClient.card.count({ where: { userId } }),
    prismaClient.card.count({ where: { userId, repetitions: { gt: 0 } } }),
    prismaClient.card.count({ where: { userId, paused: true } }),
    prismaClient.deck.count({ where: { userId } }),
    prismaClient.writingSubmission.count({ where: { userId } }),
    prismaClient.quizResult.count({ where: { userId } }),
    prismaClient.readerArticle.count({ where: { userId } }),
    prismaClient.readerBook.count({ where: { userId } }),
    prismaClient.readerArticle.count({
      where: { userId, readAt: { not: null } },
    }),
    prismaClient.readerArticleHighlight.count({ where: { userId } }),
    prismaClient.readerBookAnnotation.count({ where: { userId } }),
    prismaClient.readerArticleHighlight.count({
      where: { userId, importedAt: { not: null } },
    }),
    prismaClient.readerBookAnnotation.count({
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
    prismaClient.readerBook.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        createdAt: true,
        progress: {
          select: {
            lastOpenedAt: true,
          },
        },
      },
    }),
    prismaClient.readerArticleHighlight.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        selectedText: true,
        selectedOccurrenceIndex: true,
        occurrencesJson: true,
        createdAt: true,
        importedAt: true,
        article: {
          select: {
            title: true,
          },
        },
      },
    }),
    prismaClient.readerBookAnnotation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        quote: true,
        selectedOccurrenceIndex: true,
        occurrencesJson: true,
        chapterTitle: true,
        createdAt: true,
        importedAt: true,
        book: {
          select: {
            title: true,
          },
        },
      },
    }),
  ]);

  const combinedReaderCounts = combineReaderCounts({
    articleCount: readerArticleCount,
    bookCount: readerBookCount,
    articleHighlightCount: readerArticleHighlightCount,
    bookHighlightCount: readerBookHighlightCount,
    importedArticleHighlightCount: readerImportedArticleHighlightCount,
    importedBookHighlightCount: readerImportedBookHighlightCount,
  });
  const counts: OverviewCounts = {
    cardsTotal,
    cardsStudied,
    cardsPaused,
    deckCount,
    writingCount,
    quizResultCount,
    readerDocumentCount: combinedReaderCounts.documentCount,
    readerBookCount,
    readerReadArticleCount,
    readerHighlightCount: combinedReaderCounts.highlightCount,
    readerImportedHighlightCount:
      combinedReaderCounts.importedHighlightCount,
  };

  const recentWriting = mapRecentWritingRows(recentWritingRows);
  const recentQuiz = mapRecentQuizRows(recentQuizRows);
  const recentReaderDocuments = combineRecentReaderDocuments({
    articles: recentReaderArticleRows,
    books: recentReaderBookRows,
  });
  const recentReaderHighlights: RecentReaderHighlight[] =
    combineReaderHighlightActivity({
      articles: recentReaderArticleHighlightRows,
      books: recentReaderBookHighlightRows,
      limit: 10,
    }).map((highlight) => ({
      key: highlight.key,
      kind: highlight.kind === "article" ? "Article" : "EPUB",
      sourceTitle: highlight.sourceTitle,
      chapterTitle: highlight.chapterTitle,
      selectedText: highlight.selectedText,
      createdAt: highlight.createdAt.toISOString(),
      importedAt: highlight.importedAt?.toISOString() ?? null,
    }));

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
      recentReaderDocuments,
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
  recentReaderDocuments,
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
                  <td>Reading Documents</td>
                  <td>
                    {counts.readerDocumentCount} ({counts.readerBookCount}{" "}
                    EPUBs)
                  </td>
                </tr>
                <tr>
                  <td>Read Articles</td>
                  <td>{counts.readerReadArticleCount}</td>
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
          <Title order={4}>Recent Reading Documents</Title>
          <Table striped highlightOnHover mt="sm">
            <thead>
              <tr>
                <th>Added</th>
                <th>Type</th>
                <th>Title</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {recentReaderDocuments.length === 0 ? (
                <tr>
                  <td colSpan={4}>No reading documents yet</td>
                </tr>
              ) : (
                recentReaderDocuments.map((document) => (
                  <tr key={document.key}>
                    <td>{fmtShort(document.createdAt)}</td>
                    <td>{document.kind}</td>
                    <td>
                      <Text size="sm" lineClamp={2} maw={360}>
                        {document.title}
                      </Text>
                    </td>
                    <td>{fmtShort(document.lastActivityAt)}</td>
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
                <th>Source</th>
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
                  <tr key={highlight.key}>
                    <td>{fmtShort(highlight.createdAt)}</td>
                    <td>
                      <Text size="sm" lineClamp={2} maw={280}>
                        {highlight.kind}: {highlight.sourceTitle}
                        {highlight.chapterTitle
                          ? ` · ${highlight.chapterTitle}`
                          : ""}
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
