import {
  articleHighlightActivitySelect,
  bookHighlightActivitySelect,
} from "@/koala/reader/activity-select";
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
  SimpleGrid,
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
      select: articleHighlightActivitySelect,
    }),
    prismaClient.readerBookAnnotation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: bookHighlightActivitySelect,
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
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div style={{ minWidth: 0 }}>
            <Title order={1} size="h2">
              User overview
            </Title>
            <Text
              size="sm"
              c="pastel.6"
              style={{ overflowWrap: "anywhere" }}
            >
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

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Paper withBorder p="md" radius="md" style={{ flex: 1 }}>
            <Title order={4}>Profile</Title>
            <Table mt="sm" style={{ tableLayout: "fixed" }}>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>Email</Table.Td>
                  <Table.Td>{user.email}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Created</Table.Td>
                  <Table.Td>{fmtShort(user.createdAt)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Last Seen</Table.Td>
                  <Table.Td>{fmtShort(user.lastSeen)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>

          <Paper withBorder p="md" radius="md" style={{ flex: 1 }}>
            <Title order={4}>Counts</Title>
            <Table mt="sm" style={{ tableLayout: "fixed" }}>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>Cards</Table.Td>
                  <Table.Td>{counts.cardsTotal}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Studied Cards</Table.Td>
                  <Table.Td>{counts.cardsStudied}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Paused Cards</Table.Td>
                  <Table.Td>{counts.cardsPaused}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Decks</Table.Td>
                  <Table.Td>{counts.deckCount}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Writing Submissions</Table.Td>
                  <Table.Td>{counts.writingCount}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Quiz Results</Table.Td>
                  <Table.Td>{counts.quizResultCount}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Reading Documents</Table.Td>
                  <Table.Td>
                    {counts.readerDocumentCount} ({counts.readerBookCount}{" "}
                    EPUBs)
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Read Articles</Table.Td>
                  <Table.Td>{counts.readerReadArticleCount}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Reader Highlights</Table.Td>
                  <Table.Td>{counts.readerHighlightCount}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Imported Highlights</Table.Td>
                  <Table.Td>
                    {counts.readerImportedHighlightCount}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>
        </SimpleGrid>

        <Paper withBorder p="md" radius="md">
          <Title order={4}>Recent Writing</Title>
          <Table.ScrollContainer minWidth={560} type="native">
            <Table highlightOnHover mt="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Prompt</Table.Th>
                  <Table.Th>Chars</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentWriting.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>No writing yet</Table.Td>
                  </Table.Tr>
                ) : (
                  recentWriting.map((w) => (
                    <Table.Tr key={w.id}>
                      <Table.Td>{fmtShort(w.createdAt)}</Table.Td>
                      <Table.Td>{w.prompt}</Table.Td>
                      <Table.Td>{w.submissionCharacterCount}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Title order={4}>Recent Quiz</Title>
          <Table.ScrollContainer minWidth={560} type="native">
            <Table highlightOnHover mt="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Definition</Table.Th>
                  <Table.Th>Input</Table.Th>
                  <Table.Th>Accepted</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentQuiz.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={4}>No quiz results yet</Table.Td>
                  </Table.Tr>
                ) : (
                  recentQuiz.map((q) => (
                    <Table.Tr key={q.id}>
                      <Table.Td>{fmtShort(q.createdAt)}</Table.Td>
                      <Table.Td>{q.definition}</Table.Td>
                      <Table.Td>{q.userInput}</Table.Td>
                      <Table.Td>{yesNo(q.isAcceptable)}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Title order={4}>Recent Reading Documents</Title>
          <Table.ScrollContainer minWidth={560} type="native">
            <Table highlightOnHover mt="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Added</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Last activity</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentReaderDocuments.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      No reading documents yet
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  recentReaderDocuments.map((document) => (
                    <Table.Tr key={document.key}>
                      <Table.Td>{fmtShort(document.createdAt)}</Table.Td>
                      <Table.Td>{document.kind}</Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2} maw={360}>
                          {document.title}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {fmtShort(document.lastActivityAt)}
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Title order={4}>Recent Reader Highlights</Title>
          <Table.ScrollContainer minWidth={560} type="native">
            <Table highlightOnHover mt="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Text</Table.Th>
                  <Table.Th>Imported</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentReaderHighlights.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      No reader highlights yet
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  recentReaderHighlights.map((highlight) => (
                    <Table.Tr key={highlight.key}>
                      <Table.Td>{fmtShort(highlight.createdAt)}</Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2} maw={280}>
                          {highlight.kind}: {highlight.sourceTitle}
                          {highlight.chapterTitle
                            ? ` · ${highlight.chapterTitle}`
                            : ""}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2} maw={320}>
                          {highlight.selectedText}
                        </Text>
                      </Table.Td>
                      <Table.Td>{fmtShort(highlight.importedAt)}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      </Stack>
    </Container>
  );
}
