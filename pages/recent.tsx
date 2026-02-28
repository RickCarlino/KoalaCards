import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import {
  Box,
  Container,
  Divider,
  Paper,
  ScrollArea,
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
  createdAt: string;
};

type OutcomeRow = {
  cardId: number;
  term: string;
  definition: string;
  userInput: string;
  createdAt: string;
};

type CorrectOutcomeRow = Omit<OutcomeRow, "userInput">;

type RecentPageProps = {
  writingSamples: WritingSample[];
  wrongOutcomes: OutcomeRow[];
  correctOutcomes: CorrectOutcomeRow[];
};

type LatestCardOutcomeRow = {
  cardId: number;
  term: string;
  definition: string;
  userInput: string;
  isAcceptable: boolean;
  createdAt: Date;
};

type OutcomeDisplayRow = {
  cardId: number;
  term: string;
  definition: string;
  createdAt: string;
  userInput?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatDate = (isoDate: string) =>
  dateFormatter.format(new Date(isoDate));

const hasPrompt = (prompt: string) => {
  const trimmedPrompt = prompt.trim();
  return Boolean(trimmedPrompt) && trimmedPrompt !== DEFAULT_PROMPT;
};

const formatItemCount = (count: number) =>
  `${count} item${count === 1 ? "" : "s"}`;

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

function SectionHeading({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <Stack gap={2}>
      <Title order={3} style={{ letterSpacing: "-0.01em" }}>
        {title}
      </Title>
      {typeof count === "number" && (
        <Text size="sm" c="dimmed">
          {formatItemCount(count)}
        </Text>
      )}
    </Stack>
  );
}

function WritingSamplesSection({ samples }: { samples: WritingSample[] }) {
  if (samples.length === 0) {
    return <Text c="dimmed">No writing samples yet.</Text>;
  }

  return (
    <Stack gap="md">
      {samples.map((sample, index) => {
        const showDivider = index < samples.length - 1;

        return (
          <Box key={sample.id}>
            <Stack gap={6}>
              <Text fw={700}>{formatDate(sample.createdAt)}</Text>
              {hasPrompt(sample.prompt) && (
                <Text size="sm" style={{ lineHeight: 1.6 }}>
                  <Text component="span" fw={700}>
                    Prompt:
                  </Text>{" "}
                  {sample.prompt.trim()}
                </Text>
              )}
              <Text
                size="sm"
                style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}
              >
                {sample.submission}
              </Text>
            </Stack>
            {showDivider && <Divider my="md" />}
          </Box>
        );
      })}
    </Stack>
  );
}

function OutcomeSection({
  title,
  rows,
  includeInputColumn,
  emptyMessage,
}: {
  title: string;
  rows: OutcomeDisplayRow[];
  includeInputColumn: boolean;
  emptyMessage: string;
}) {
  const columnCount = includeInputColumn ? 5 : 4;

  return (
    <Stack gap="sm">
      <SectionHeading title={title} count={rows.length} />
      <ScrollArea type="auto">
        <Table
          withColumnBorders
          withTableBorder
          horizontalSpacing="md"
          verticalSpacing="xs"
          style={{ minWidth: 720 }}
        >
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={columnCount}>
                  <Text size="sm" c="dimmed">
                    {emptyMessage}
                  </Text>
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.cardId}>
                <td>{formatDate(row.createdAt)}</td>
                <td>{row.term}</td>
                <td>{row.definition}</td>
                {includeInputColumn && <td>{row.userInput ?? ""}</td>}
                <td>{row.cardId}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}

export default function RecentPage({
  writingSamples,
  wrongOutcomes,
  correctOutcomes,
}: RecentPageProps) {
  return (
    <Container size="lg" py={{ base: "md", sm: "xl" }}>
      <Paper
        withBorder
        radius="lg"
        p={{ base: "md", sm: "xl" }}
        style={{
          background:
            "linear-gradient(180deg, rgba(255, 248, 251, 0.96), rgba(255, 255, 255, 1))",
          borderColor: "rgba(221, 170, 190, 0.55)",
          fontFamily:
            '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
        }}
      >
        <Stack gap="xl">
          <Stack gap={4}>
            <Title
              order={2}
              style={{
                letterSpacing: "-0.015em",
                fontSize: "clamp(1.55rem, 2.2vw, 2rem)",
              }}
            >
              Recent Study Activity
            </Title>
            <Text c="dimmed" size="sm" style={{ lineHeight: 1.7 }}>
              Writing samples and quiz outcomes from recent sessions.
            </Text>
          </Stack>

          <Divider />

          <Stack gap="sm">
            <SectionHeading
              title="Recent Writing Samples"
              count={writingSamples.length}
            />
            <WritingSamplesSection samples={writingSamples} />
          </Stack>

          <Divider />

          <OutcomeSection
            title="Recent Wrong Answers"
            rows={wrongOutcomes}
            includeInputColumn
            emptyMessage="No wrong answers found."
          />

          <Divider />

          <OutcomeSection
            title="Recent Correct Answers"
            rows={correctOutcomes}
            includeInputColumn={false}
            emptyMessage="No correct answers found."
          />
        </Stack>
      </Paper>
    </Container>
  );
}
