import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import Head from "next/head";
import type {
  GetServerSideProps,
  InferGetServerSidePropsType,
} from "next";

type ReaderExportArticle = {
  id: number;
  title: string;
  highlights: Array<{
    id: number;
    keyword: string;
    snippet: string;
  }>;
};

type Props = {
  articles: ReaderExportArticle[];
};

const normalizeText = (value: string): string => {
  return value.trim();
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

const buildHighlightExport = (options: {
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrencesJson: unknown;
}): { keyword: string; snippet: string } | null => {
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
    return {
      keyword: match,
      snippet: wrappedMatch,
    };
  }

  const prefix = before.length > 0 ? `...${before} ` : "";
  const suffix = after.length > 0 ? ` ${after}...` : "";
  return {
    keyword: match,
    snippet: `${prefix}${wrappedMatch}${suffix}`.trim(),
  };
};

export const getServerSideProps: GetServerSideProps<Props> = async (
  context,
) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const articles = await prismaClient.readerArticle.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      highlights: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          selectedText: true,
          selectedOccurrenceIndex: true,
          occurrencesJson: true,
        },
      },
    },
  });

  return {
    props: {
      articles: articles.map((article) => {
        const title = normalizeText(article.title);
        return {
          id: article.id,
          title: title.length > 0 ? title : "Untitled article",
          highlights: article.highlights
            .map((highlight) => {
              const exportHighlight = buildHighlightExport({
                selectedText: normalizeText(highlight.selectedText),
                selectedOccurrenceIndex: highlight.selectedOccurrenceIndex,
                occurrencesJson: highlight.occurrencesJson,
              });

              if (!exportHighlight) {
                return null;
              }

              return {
                id: highlight.id,
                keyword: exportHighlight.keyword,
                snippet: exportHighlight.snippet,
              };
            })
            .filter(
              (
                highlight,
              ): highlight is {
                id: number;
                keyword: string;
                snippet: string;
              } => {
                return Boolean(highlight);
              },
            ),
        };
      }),
    },
  };
};

export default function ReaderExportPage({
  articles,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <>
      <Head>
        <title>Reader Export · Koala Cards</title>
      </Head>
      <main style={{ padding: "16px", maxWidth: 960 }}>
        <h1>Reader Export</h1>
        {articles.length === 0 && <p>No reader articles found.</p>}
        {articles.map((article) => {
          return (
            <section key={article.id} style={{ marginBottom: "24px" }}>
              <h2>{article.title}</h2>
              {article.highlights.length === 0 ? (
                <p>No highlights.</p>
              ) : (
                <div>
                  {article.highlights.map((highlight) => {
                    return (
                      <section
                        key={highlight.id}
                        style={{ marginBottom: "12px" }}
                      >
                        <h3 style={{ marginTop: 0, marginBottom: "4px" }}>
                          {highlight.keyword}
                        </h3>
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontFamily: "inherit",
                          }}
                        >
                          {highlight.snippet}
                        </pre>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}
