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
import type { FormEvent } from "react";
import {
  formatIsoDateTimeShort,
  formatYesNo,
} from "@/koala/utils/formatters";

export type UserOverviewCounts = {
  cardsTotal: number;
  cardsStudied: number;
  cardsFlagged: number;
  deckCount: number;
  writingCount: number;
  quizResultCount: number;
};

export type UserOverviewRecentWriting = {
  id: number;
  prompt: string;
  createdAt: string;
  submissionCharacterCount: number;
};

export type UserOverviewRecentQuiz = {
  id: number;
  createdAt: string;
  definition: string;
  userInput: string;
  isAcceptable: boolean;
};

export type UserOverviewUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastSeen: string | null;
};

export type UserOverviewViewProps = {
  user: UserOverviewUser;
  error: string | null;
  counts: UserOverviewCounts;
  recentWriting: UserOverviewRecentWriting[];
  recentQuiz: UserOverviewRecentQuiz[];
};

export function UserOverviewView(props: UserOverviewViewProps) {
  return (
    <Container size="lg" mt="xl">
      <Stack gap="md">
        <UserOverviewHeader
          email={props.user.email}
          name={props.user.name}
          error={props.error}
        />

        <Group align="stretch">
          <ProfileCard user={props.user} />
          <CountsCard counts={props.counts} />
        </Group>

        <RecentWritingCard rows={props.recentWriting} />
        <RecentQuizCard rows={props.recentQuiz} />
      </Stack>
    </Container>
  );
}

function UserOverviewHeader(props: {
  email: string;
  name: string | null;
  error: string | null;
}) {
  return (
    <Group justify="space-between" align="center">
      <div>
        <Title order={2}>User Overview</Title>
        <Text size="sm" c="dimmed">
          {props.email}
          <UserNameSuffix name={props.name} />
        </Text>
        <ErrorText error={props.error} />
      </div>
      <DeleteUserForm />
    </Group>
  );
}

function UserNameSuffix(props: { name: string | null }) {
  if (!props.name) {
    return null;
  }
  return <> • {props.name}</>;
}

function ErrorText(props: { error: string | null }) {
  if (!props.error) {
    return null;
  }
  return (
    <Text size="sm" c="red" mt="xs">
      {props.error}
    </Text>
  );
}

function DeleteUserForm() {
  return (
    <form method="POST" action="?intent=delete" onSubmit={confirmDelete}>
      <Button color="red" variant="outline" type="submit">
        Delete User
      </Button>
    </form>
  );
}

function confirmDelete(event: FormEvent<HTMLFormElement>) {
  if (typeof window === "undefined") {
    return;
  }

  const ok = window.confirm(
    "Delete this user and all related data? This cannot be undone.",
  );
  if (!ok) {
    event.preventDefault();
  }
}

function ProfileCard(props: { user: UserOverviewUser }) {
  return (
    <Paper withBorder p="md" radius="md" style={{ flex: 1 }}>
      <Title order={4}>Profile</Title>
      <KeyValueTable
        rows={[
          { k: "Email", v: props.user.email },
          {
            k: "Created",
            v: formatIsoDateTimeShort(props.user.createdAt),
          },
          {
            k: "Last Seen",
            v: formatIsoDateTimeShort(props.user.lastSeen),
          },
        ]}
      />
    </Paper>
  );
}

function CountsCard(props: { counts: UserOverviewCounts }) {
  return (
    <Paper withBorder p="md" radius="md" style={{ flex: 1 }}>
      <Title order={4}>Counts</Title>
      <KeyValueTable
        rows={[
          { k: "Cards", v: String(props.counts.cardsTotal) },
          { k: "Studied Cards", v: String(props.counts.cardsStudied) },
          { k: "Flagged Cards", v: String(props.counts.cardsFlagged) },
          { k: "Decks", v: String(props.counts.deckCount) },
          {
            k: "Writing Submissions",
            v: String(props.counts.writingCount),
          },
          { k: "Quiz Results", v: String(props.counts.quizResultCount) },
        ]}
      />
    </Paper>
  );
}

function KeyValueTable(props: { rows: { k: string; v: string }[] }) {
  return (
    <Table mt="sm">
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.k}>
            <td>{row.k}</td>
            <td>{row.v}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function RecentWritingCard(props: { rows: UserOverviewRecentWriting[] }) {
  return (
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
          <RecentWritingRows rows={props.rows} />
        </tbody>
      </Table>
    </Paper>
  );
}

function RecentWritingRows(props: { rows: UserOverviewRecentWriting[] }) {
  if (props.rows.length === 0) {
    return <EmptyRow colSpan={3} label="No writing yet" />;
  }

  return props.rows.map((row) => (
    <tr key={row.id}>
      <td>{formatIsoDateTimeShort(row.createdAt)}</td>
      <td>{row.prompt}</td>
      <td>{row.submissionCharacterCount}</td>
    </tr>
  ));
}

function RecentQuizCard(props: { rows: UserOverviewRecentQuiz[] }) {
  return (
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
          <RecentQuizRows rows={props.rows} />
        </tbody>
      </Table>
    </Paper>
  );
}

function RecentQuizRows(props: { rows: UserOverviewRecentQuiz[] }) {
  if (props.rows.length === 0) {
    return <EmptyRow colSpan={4} label="No quiz results yet" />;
  }

  return props.rows.map((row) => (
    <tr key={row.id}>
      <td>{formatIsoDateTimeShort(row.createdAt)}</td>
      <td>{row.definition}</td>
      <td>{row.userInput}</td>
      <td>{formatYesNo(row.isAcceptable)}</td>
    </tr>
  ));
}

function EmptyRow(props: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={props.colSpan}>{props.label}</td>
    </tr>
  );
}
