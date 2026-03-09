import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { Container, Stack, Table, Title } from "@mantine/core";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";

const WRITING_SAMPLE_LIMIT = 5;
const WRONG_OUTCOME_LIMIT = 50;
const CORRECT_OUTCOME_LIMIT = 10;
const RECENT_HIGHLIGHT_LIMIT = 10;
const SPEAKING_EVENT_TYPE = "speaking-judgement";
const DEFAULT_PROMPT = "Not set.";

type WritingSample = {
  id: number;
  prompt: string;
  submission: string;
  createdAt: string;
};

type WrongOutcomeRow = {
  term: string;
  definition: string;
  userInput: string;
  createdAt: string;
};

type CorrectOutcomeRow = {
  definition: string;
  userInput: string;
  createdAt: string;
};

type RecentHighlightWord = {
  id: number;
  context: string;
};

type RecentPageProps = {
  writingSamples: WritingSample[];
  wrongOutcomes: WrongOutcomeRow[];
  correctOutcomes: CorrectOutcomeRow[];
  recentHighlights: RecentHighlightWord[];
};

type LatestCardOutcomeRow = {
  cardId: number;
  term: string;
  definition: string;
  userInput: string;
  isAcceptable: boolean;
  createdAt: Date;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const formatDate = (isoDate: string) =>
  dateFormatter.format(new Date(isoDate));

const hasPrompt = (prompt: string) => {
  const trimmedPrompt = prompt.trim();
  return Boolean(trimmedPrompt) && trimmedPrompt !== DEFAULT_PROMPT;
};

type HighlightOccurrence = {
  before: string;
  match: string;
  after: string;
};

const parseHighlightOccurrences = (
  value: unknown,
): HighlightOccurrence[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: HighlightOccurrence[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const maybeBefore = (item as { before?: unknown }).before;
    const maybeMatch = (item as { match?: unknown }).match;
    const maybeAfter = (item as { after?: unknown }).after;

    if (
      typeof maybeBefore !== "string" ||
      typeof maybeMatch !== "string" ||
      typeof maybeAfter !== "string"
    ) {
      continue;
    }

    parsed.push({
      before: maybeBefore,
      match: maybeMatch,
      after: maybeAfter,
    });
  }

  return parsed;
};

const normalizeSnippetChunk = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const buildHighlightContextSnippet = (options: {
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrencesJson: unknown;
}): string | null => {
  const occurrences = parseHighlightOccurrences(options.occurrencesJson);
  const selectedOccurrence =
    occurrences[options.selectedOccurrenceIndex] ?? null;

  const before = normalizeSnippetChunk(selectedOccurrence?.before ?? "");
  const match = normalizeSnippetChunk(
    selectedOccurrence?.match ?? options.selectedText,
  );
  const after = normalizeSnippetChunk(selectedOccurrence?.after ?? "");

  if (match.length === 0) {
    return null;
  }

  const wrappedMatch = `{{ ${match} }}`;

  if (before.length === 0 && after.length === 0) {
    return wrappedMatch;
  }

  const prefix = before.length > 0 ? `...${before} ` : "";
  const suffix = after.length > 0 ? ` ${after}...` : "";
  return `${prefix}${wrappedMatch}${suffix}`.trim();
};

const toSerializableOutcome = (
  row: LatestCardOutcomeRow,
): Omit<WrongOutcomeRow, "createdAt"> & { createdAt: string } => ({
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

  const [writingRows, latestCardOutcomes, highlightRows] =
    await Promise.all([
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
      prismaClient.readerArticleHighlight.findMany({
        where: {
          userId: dbUser.id,
          status: "READY",
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          term: true,
          selectedText: true,
          selectedOccurrenceIndex: true,
          occurrencesJson: true,
        },
      }),
    ]);

  const sortedOutcomes = latestCardOutcomes.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const wrongOutcomes = sortedOutcomes
    .filter((row) => !row.isAcceptable)
    .slice(0, WRONG_OUTCOME_LIMIT)
    .map(toSerializableOutcome);

  const correctOutcomes = sortedOutcomes
    .filter((row) => row.isAcceptable)
    .slice(0, CORRECT_OUTCOME_LIMIT)
    .map((row) => {
      const serializable = toSerializableOutcome(row);
      return {
        definition: serializable.definition,
        userInput: serializable.userInput,
        createdAt: serializable.createdAt,
      };
    });

  const writingSamples = writingRows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    submission: row.submission,
    createdAt: row.createdAt.toISOString(),
  }));

  const recentHighlights = highlightRows
    .map((row) => {
      const context = buildHighlightContextSnippet({
        selectedText: row.selectedText.trim(),
        selectedOccurrenceIndex: row.selectedOccurrenceIndex,
        occurrencesJson: row.occurrencesJson,
      });
      if (!context) {
        return null;
      }

      return {
        id: row.id,
        context,
      };
    })
    .filter(
      (row): row is RecentHighlightWord =>
        row !== null && row.context.length > 0,
    )
    .slice(0, RECENT_HIGHLIGHT_LIMIT);

  return {
    props: {
      writingSamples,
      wrongOutcomes,
      correctOutcomes,
      recentHighlights,
    },
  };
};

function SectionHeading({ title }: { title: string }) {
  return (
    <Title
      order={4}
      style={{ letterSpacing: "-0.01em", lineHeight: 1.15 }}
    >
      {title}
    </Title>
  );
}

function WritingSamplesSection({ samples }: { samples: WritingSample[] }) {
  return (
    <section className="recent-print-section">
      <Stack gap={4}>
        <SectionHeading title="최근 작문 샘플" />
        <Table
          withColumnBorders
          withTableBorder
          horizontalSpacing="xs"
          verticalSpacing={4}
          className="recent-print-table"
          style={{ tableLayout: "fixed" }}
        >
          <thead>
            <tr>
              <th style={{ width: "8.5rem" }}>날짜</th>
              <th style={{ width: "16rem" }}>프롬프트</th>
              <th>작성문</th>
            </tr>
          </thead>
          <tbody>
            {samples.length === 0 && (
              <tr>
                <td colSpan={3}>없음</td>
              </tr>
            )}
            {samples.map((sample) => (
              <tr key={sample.id}>
                <td>{formatDate(sample.createdAt)}</td>
                <td>
                  {hasPrompt(sample.prompt) ? sample.prompt.trim() : ""}
                </td>
                <td style={{ whiteSpace: "pre-wrap" }}>
                  {sample.submission}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
    </section>
  );
}

function WrongOutcomesSection({ rows }: { rows: WrongOutcomeRow[] }) {
  return (
    <section className="recent-print-section">
      <Stack gap={4}>
        <SectionHeading title="최근 오답" />
        <Table
          withColumnBorders
          withTableBorder
          horizontalSpacing="xs"
          verticalSpacing={4}
          className="recent-print-table"
          style={{ tableLayout: "fixed" }}
        >
          <thead>
            <tr>
              <th>뜻</th>
              <th>단어</th>
              <th>내 답변</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3}>없음</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={`${row.createdAt}-${row.term}-${row.userInput}`}>
                <td>{row.definition}</td>
                <td>{row.term}</td>
                <td>{row.userInput}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
    </section>
  );
}

function CorrectOutcomesSection({ rows }: { rows: CorrectOutcomeRow[] }) {
  return (
    <section className="recent-print-section">
      <Stack gap={4}>
        <SectionHeading title="최근 정답" />
        <Table
          withColumnBorders
          withTableBorder
          horizontalSpacing="xs"
          verticalSpacing={4}
          className="recent-print-table"
          style={{ tableLayout: "fixed" }}
        >
          <thead>
            <tr>
              <th>내 답변</th>
              <th>뜻</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={2}>없음</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={`${row.createdAt}-${row.userInput}-${row.definition}`}
              >
                <td>{row.userInput}</td>
                <td>{row.definition}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
    </section>
  );
}

function RecentHighlightsSection({
  rows,
}: {
  rows: RecentHighlightWord[];
}) {
  const renderContext = (context: string) => {
    const startToken = "{{ ";
    const endToken = " }}";
    const startIndex = context.indexOf(startToken);
    if (startIndex < 0) {
      return context;
    }

    const matchStart = startIndex + startToken.length;
    const endIndex = context.indexOf(endToken, matchStart);
    if (endIndex < 0) {
      return context;
    }

    const before = context.slice(0, startIndex);
    const match = context.slice(matchStart, endIndex);
    const after = context.slice(endIndex + endToken.length);

    return (
      <>
        {before}
        {"{{ "}
        <strong>{match}</strong>
        {" }}"}
        {after}
      </>
    );
  };

  return (
    <section className="recent-print-section">
      <Stack gap={4}>
        <SectionHeading title="최근 하이라이트 단어" />
        <Table
          withColumnBorders
          withTableBorder
          horizontalSpacing="xs"
          verticalSpacing={4}
          className="recent-print-table"
          style={{ tableLayout: "fixed" }}
        >
          <thead>
            <tr>
              <th>문맥</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td>없음</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{renderContext(row.context)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
    </section>
  );
}

export default function RecentPage({
  writingSamples,
  wrongOutcomes,
  correctOutcomes,
  recentHighlights,
}: RecentPageProps) {
  const router = useRouter();
  const handleBack = () => {
    if (
      typeof window !== "undefined" &&
      window.history &&
      window.history.length > 1
    ) {
      router.back();
      return;
    }

    void router.push("/");
  };

  return (
    <>
      <style jsx global>{`
        .recent-print-root {
          color: #111;
        }

        .recent-print-table th,
        .recent-print-table td {
          vertical-align: top;
          line-height: 1.2;
          font-size: 12px;
        }

        .recent-back-button {
          border: 0;
          background: transparent;
          padding: 0;
          margin: 0;
          width: fit-content;
          font-size: 11px;
          line-height: 1;
          opacity: 0.6;
          color: #111;
          cursor: pointer;
        }

        .recent-back-button:hover {
          opacity: 0.85;
        }

        @media print {
          @page {
            margin: 10mm;
          }

          .recent-print-root {
            max-width: none !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }

          .recent-print-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .recent-print-table th,
          .recent-print-table td {
            padding: 3px 6px !important;
            line-height: 1.15 !important;
            font-size: 11px !important;
          }

          .recent-back-button {
            display: none;
          }
        }
      `}</style>

      <Container size="xl" py="xs" className="recent-print-root">
        <Stack gap={8}>
          <button
            type="button"
            className="recent-back-button"
            onClick={handleBack}
          >
            ← 뒤로
          </button>
          <Title
            order={3}
            style={{ letterSpacing: "-0.01em", lineHeight: 1.1 }}
          >
            최근 학습 활동
          </Title>
          <WritingSamplesSection samples={writingSamples} />
          <RecentHighlightsSection rows={recentHighlights} />
          <WrongOutcomesSection rows={wrongOutcomes} />
          <CorrectOutcomesSection rows={correctOutcomes} />
        </Stack>
      </Container>
    </>
  );
}
