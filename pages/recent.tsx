import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import {
  Badge,
  Container,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { GetServerSideProps } from "next";

const WRITING_SAMPLE_LIMIT = 5;
const OUTCOME_LIMIT = 50;
const SPEAKING_EVENT_TYPE = "speaking-judgement";
const DEFAULT_PROMPT = "Not set.";

type WritingSample = {
  id: number;
  prompt: string;
  submission: string;
  submissionCharacterCount: number;
  createdAt: string;
};

type OutcomeRow = {
  cardId: number;
  term: string;
  definition: string;
  userInput: string;
  createdAt: string;
};

type RecentPageProps = {
  writingSamples: WritingSample[];
  wrongOutcomes: OutcomeRow[];
  correctOutcomes: Omit<OutcomeRow, "userInput">[];
};

type LatestCardOutcomeRow = {
  cardId: number;
  term: string;
  definition: string;
  userInput: string;
  isAcceptable: boolean;
  createdAt: Date;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatDate = (isoDate: string) =>
  dateFormatter.format(new Date(isoDate));

const getPromptLabel = (prompt: string) => {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt || trimmedPrompt === DEFAULT_PROMPT) {
    return "No prompt provided";
  }
  return trimmedPrompt;
};

const toSerializableOutcome = (
  row: LatestCardOutcomeRow,
): Omit<OutcomeRow, "createdAt"> & { createdAt: string } => ({
  cardId: row.cardId,
  term: row.term,
  definition: row.definition,
  userInput: row.userInput,
  createdAt: row.createdAt.toISOString(),
});

export const getServerSideProps: GetServerSideProps<
  RecentPageProps
> = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const [writingRows, latestCardOutcomes] = await Promise.all([
    prismaClient.writingSubmission.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: WRITING_SAMPLE_LIMIT,
      select: {
        id: true,
        prompt: true,
        submission: true,
        submissionCharacterCount: true,
        createdAt: true,
      },
    }),
    prismaClient.$queryRaw<LatestCardOutcomeRow[]>`
      SELECT DISTINCT ON (c.id)
        c.id AS "cardId",
        c.term AS term,
        c.definition AS definition,
        q."userInput" AS "userInput",
        q."isAcceptable" AS "isAcceptable",
        q."createdAt" AS "createdAt"
      FROM "Card" c
      JOIN "QuizResult" q
        ON q."userId" = c."userId"
       AND q."acceptableTerm" = c.term
      WHERE c."userId" = ${dbUser.id}
        AND q."eventType" = ${SPEAKING_EVENT_TYPE}
      ORDER BY c.id, q."createdAt" DESC, q.id DESC
    `,
  ]);

  const sortedOutcomes = latestCardOutcomes.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const wrongOutcomes = sortedOutcomes
    .filter((row) => !row.isAcceptable)
    .slice(0, OUTCOME_LIMIT)
    .map(toSerializableOutcome);

  const correctOutcomes = sortedOutcomes
    .filter((row) => row.isAcceptable)
    .slice(0, OUTCOME_LIMIT)
    .map((row) => {
      const serializable = toSerializableOutcome(row);
      return {
        cardId: serializable.cardId,
        term: serializable.term,
        definition: serializable.definition,
        createdAt: serializable.createdAt,
      };
    });

  const writingSamples = writingRows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    submission: row.submission,
    submissionCharacterCount: row.submissionCharacterCount,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    props: {
      writingSamples,
      wrongOutcomes,
      correctOutcomes,
    },
  };
};

function SummaryBanner({
  writingCount,
  wrongCount,
  correctCount,
}: {
  writingCount: number;
  wrongCount: number;
  correctCount: number;
}) {
  return (
    <Paper
      withBorder
      radius="lg"
      p="lg"
      style={{
        background:
          "linear-gradient(135deg, rgba(255, 240, 246, 0.95), rgba(255, 250, 252, 1))",
      }}
    >
      <Stack gap="xs">
        <Title order={2} c="pink.8">
          Recent Activity
        </Title>
        <Text c="gray.7">
          Last {WRITING_SAMPLE_LIMIT} writing samples, plus deduplicated
          latest quiz outcomes per card.
        </Text>
        <Group gap="xs" mt="xs">
          <Badge color="pink" variant="light">
            Writing: {writingCount}
          </Badge>
          <Badge color="red" variant="light">
            Wrong: {wrongCount}
          </Badge>
          <Badge color="teal" variant="light">
            Correct: {correctCount}
          </Badge>
        </Group>
      </Stack>
    </Paper>
  );
}

function WritingSamplesPanel({ samples }: { samples: WritingSample[] }) {
  const hasSamples = samples.length > 0;

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={4} c="pink.8">
            Last {WRITING_SAMPLE_LIMIT} Writing Samples
          </Title>
          <Text size="sm" c="dimmed">
            Pre-correction text
          </Text>
        </Group>

        {!hasSamples && (
          <Text c="dimmed">
            No writing samples yet. Complete a writing review to populate
            this section.
          </Text>
        )}

        {hasSamples &&
          samples.map((sample) => (
            <Paper
              key={sample.id}
              withBorder
              radius="md"
              p="sm"
              bg="pink.0"
            >
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Badge color="pink" variant="outline">
                    {formatDate(sample.createdAt)}
                  </Badge>
                  <Badge color="gray" variant="light">
                    {sample.submissionCharacterCount} chars
                  </Badge>
                </Group>
                <Text fw={600} c="gray.8">
                  {getPromptLabel(sample.prompt)}
                </Text>
                <ScrollArea h={130} type="auto">
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {sample.submission}
                  </Text>
                </ScrollArea>
              </Stack>
            </Paper>
          ))}
      </Stack>
    </Paper>
  );
}

function OutcomeTable({
  title,
  subtitle,
  rows,
  includeInputColumn,
  emptyMessage,
  color,
}: {
  title: string;
  subtitle: string;
  rows: Array<
    {
      cardId: number;
      term: string;
      definition: string;
      createdAt: string;
    } & Partial<Pick<OutcomeRow, "userInput">>
  >;
  includeInputColumn: boolean;
  emptyMessage: string;
  color: "red" | "teal";
}) {
  const hasRows = rows.length > 0;
  const rowSpan = includeInputColumn ? 5 : 4;

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={4} c={`${color}.8`}>
            {title}
          </Title>
          <Badge color={color} variant="light">
            {rows.length}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {subtitle}
        </Text>
        <ScrollArea h={500} type="auto">
          <Table striped highlightOnHover withColumnBorders>
            <thead>
              <tr>
                <th>Date</th>
                <th>Term</th>
                <th>Definition</th>
                {includeInputColumn && <th>My Input</th>}
                <th>Card ID</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows && (
                <tr>
                  <td colSpan={rowSpan}>
                    <Text size="sm" c="dimmed">
                      {emptyMessage}
                    </Text>
                  </td>
                </tr>
              )}
              {hasRows &&
                rows.map((row) => (
                  <tr key={row.cardId}>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <Text size="sm">{row.term}</Text>
                    </td>
                    <td>
                      <Text size="sm">{row.definition}</Text>
                    </td>
                    {includeInputColumn && (
                      <td>
                        <Text size="sm">{row.userInput ?? ""}</Text>
                      </td>
                    )}
                    <td>
                      <Badge variant="outline" color="gray">
                        {row.cardId}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

export default function RecentPage({
  writingSamples,
  wrongOutcomes,
  correctOutcomes,
}: RecentPageProps) {
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <SummaryBanner
          writingCount={writingSamples.length}
          wrongCount={wrongOutcomes.length}
          correctCount={correctOutcomes.length}
        />
        <WritingSamplesPanel samples={writingSamples} />
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          <OutcomeTable
            title={`Last ${OUTCOME_LIMIT} Wrong`}
            subtitle="Deduplicated by card. Latest result wins."
            rows={wrongOutcomes}
            includeInputColumn
            emptyMessage="No wrong cards found in recent outcomes."
            color="red"
          />
          <OutcomeTable
            title={`Last ${OUTCOME_LIMIT} Correct`}
            subtitle="Deduplicated by card. Latest result wins."
            rows={correctOutcomes}
            includeInputColumn={false}
            emptyMessage="No correct cards found in recent outcomes."
            color="teal"
          />
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
