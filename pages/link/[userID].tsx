import React from "react";
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from "next";
import { getSession } from "next-auth/react";
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

type OverviewCounts = {
  cardsTotal: number;
  cardsStudied: number;
  cardsFlagged: number;
  deckCount: number;
  writingCount: number;
  quizResultCount: number;
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

export async function getServerSideProps(
  context: GetServerSidePropsContext,
) {
  const session = await getSession({ req: context.req });
  const email = session?.user?.email?.toLowerCase() ?? null;

  const superUsers = (process.env.AUTHORIZED_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.includes("@"));

  if (!email || !superUsers.includes(email)) {
    return {
      redirect: {
        destination: "/user",
        permanent: false,
      },
    };
  }

  const userId = context.params?.userID as string | undefined;
  if (!userId) {
    return { notFound: true };
  }

  if (context.req.method === "POST" && context.query.intent === "delete") {
    await prismaClient.user.delete({ where: { id: userId } });
    return {
      redirect: { destination: "/admin", permanent: false },
    };
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
    cardsFlagged,
    deckCount,
    writingCount,
    quizResultCount,
  ] = await Promise.all([
    prismaClient.card.count({ where: { userId } }),
    prismaClient.card.count({ where: { userId, repetitions: { gt: 0 } } }),
    prismaClient.card.count({ where: { userId, flagged: true } }),
    prismaClient.deck.count({ where: { userId } }),
    prismaClient.writingSubmission.count({ where: { userId } }),
    prismaClient.quizResult.count({ where: { userId } }),
  ]);

  const recentWritingRows = await prismaClient.writingSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      prompt: true,
      createdAt: true,
      submissionCharacterCount: true,
    },
  });

  const recentQuizRows = await prismaClient.quizResult.findMany({
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
  });

  const counts: OverviewCounts = {
    cardsTotal,
    cardsStudied,
    cardsFlagged,
    deckCount,
    writingCount,
    quizResultCount,
  };

  const recentWriting: RecentWriting[] = recentWritingRows.map((w) => ({
    id: w.id,
    prompt: w.prompt,
    createdAt: w.createdAt.toISOString(),
    submissionCharacterCount: w.submissionCharacterCount,
  }));

  const recentQuiz: RecentQuiz[] = recentQuizRows.map((q) => ({
    id: q.id,
    createdAt: q.createdAt.toISOString(),
    definition: q.definition,
    userInput: q.userInput,
    isAcceptable: q.isAcceptable,
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
      counts,
      recentWriting,
      recentQuiz,
    },
  };
}

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function fmtShort(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const MONTHS = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export default function UserOverviewPage({
  user,
  counts,
  recentWriting,
  recentQuiz,
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
                  <td>Flagged Cards</td>
                  <td>{counts.cardsFlagged}</td>
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
      </Stack>
    </Container>
  );
}
