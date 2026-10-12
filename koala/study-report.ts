import {
  articleHighlightActivitySelect,
  bookHighlightActivitySelect,
} from "@/koala/reader/activity-select";
import { prismaClient } from "@/koala/prisma-client";
import { combineReaderHighlightActivity } from "@/koala/reader/activity";

const WRITING_SAMPLE_LIMIT = 5;
const WRONG_OUTCOME_LIMIT = 50;
const CORRECT_OUTCOME_LIMIT = 10;
const RECENT_HIGHLIGHT_LIMIT = 10;
const SPEAKING_EVENT_TYPE = "speaking-judgement";

type LatestCardOutcomeRow = {
  id: number;
  cardId: number;
  term: string;
  definition: string;
  userInput: string;
  isAcceptable: boolean;
  grade: string | null;
  reason: string;
  createdAt: Date;
};

const toSerializableOutcome = (row: LatestCardOutcomeRow) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

export async function getStudyReport(userId: string) {
  const [
    writingRows,
    latestCardOutcomes,
    articleHighlightRows,
    bookHighlightRows,
  ] = await Promise.all([
    prismaClient.writingSubmission.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
        q.id AS id,
        q.grade AS grade,
        q.reason AS reason,
        c.term AS term,
        c.definition AS definition,
        q."userInput" AS "userInput",
        q."isAcceptable" AS "isAcceptable",
        q."createdAt" AS "createdAt"
      FROM "Card" c
      JOIN "QuizResult" q
        ON q."userId" = c."userId"
       AND q."acceptableTerm" = c.term
      WHERE c."userId" = ${userId}
        AND q."eventType" = ${SPEAKING_EVENT_TYPE}
      ORDER BY c.id, q."createdAt" DESC, q.id DESC
    `,
    prismaClient.readerArticleHighlight.findMany({
      where: {
        userId,
        status: "READY",
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: articleHighlightActivitySelect,
    }),
    prismaClient.readerBookAnnotation.findMany({
      where: {
        userId,
        status: "READY",
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: bookHighlightActivitySelect,
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
    .map(toSerializableOutcome);

  const writingSamples = writingRows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    submission: row.submission,
    createdAt: row.createdAt.toISOString(),
  }));

  const recentHighlights = combineReaderHighlightActivity({
    articles: articleHighlightRows,
    books: bookHighlightRows,
    limit: RECENT_HIGHLIGHT_LIMIT,
  }).map((highlight) => ({
    key: highlight.key,
    selectedText: highlight.selectedText,
    createdAt: highlight.createdAt.toISOString(),
    context: highlight.context,
    source:
      highlight.kind === "book" && highlight.chapterTitle
        ? `${highlight.sourceTitle} · ${highlight.chapterTitle}`
        : highlight.sourceTitle,
  }));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    writingSamples,
    wrongOutcomes,
    correctOutcomes,
    recentHighlights,
  };
}

export type StudyReport = Awaited<ReturnType<typeof getStudyReport>>;
