import { getServersideUser } from "@/koala/get-serverside-user";
import { getStudyReport, type StudyReport } from "@/koala/study-report";
import { Container, Stack, Table, Title } from "@mantine/core";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";

type RecentPageProps = StudyReport;
type WritingSample = StudyReport["writingSamples"][number];
type WrongOutcomeRow = StudyReport["wrongOutcomes"][number];
type CorrectOutcomeRow = StudyReport["correctOutcomes"][number];
type RecentHighlightWord = StudyReport["recentHighlights"][number];

const hasPrompt = (prompt: string) => {
  const trimmedPrompt = prompt.trim();
  return Boolean(trimmedPrompt) && trimmedPrompt !== "Not set.";
};

export const getServerSideProps: GetServerSideProps<
  RecentPageProps
> = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  return { props: await getStudyReport(dbUser.id) };
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
              <th>작성문</th>
            </tr>
          </thead>
          <tbody>
            {samples.length === 0 && (
              <tr>
                <td>없음</td>
              </tr>
            )}
            {samples.map((sample) => (
              <tr key={sample.id}>
                <td style={{ whiteSpace: "pre-wrap" }}>
                  {hasPrompt(sample.prompt) && (
                    <strong>{sample.prompt.trim()} </strong>
                  )}
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
              <th>출처</th>
              <th>문맥</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={2}>없음</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.source}</td>
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
