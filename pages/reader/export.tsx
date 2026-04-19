import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import {
  buildHighlightSnippet,
  normalizeHighlightText,
} from "@/koala/reader/highlight-snippet";
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
        const title = normalizeHighlightText(article.title);
        return {
          id: article.id,
          title: title.length > 0 ? title : "Untitled article",
          highlights: article.highlights
            .map((highlight) => {
              const exportHighlight = buildHighlightSnippet({
                selectedText: normalizeHighlightText(
                  highlight.selectedText,
                ),
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
