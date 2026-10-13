import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prismaClient as db } from "@/koala/prisma-client";
import { dueCardsWhere } from "./due-cards";
import { settingsSelect } from "./record-selects";
import { dateFilters, dateWhere, registerStudyTool } from "./tools";

async function activity(
  userId: string,
  range: ReturnType<typeof dateWhere>,
) {
  const quizWhere = {
    userId,
    createdAt: range,
    eventType: "speaking-judgement",
  };
  const [
    answers,
    correct,
    writing,
    reviews,
    articleHighlights,
    bookHighlights,
    calls,
  ] = await Promise.all([
    db.quizResult.count({ where: quizWhere }),
    db.quizResult.count({ where: { ...quizWhere, isAcceptable: true } }),
    db.writingSubmission.aggregate({
      where: { userId, createdAt: range },
      _count: true,
      _sum: { submissionCharacterCount: true },
    }),
    db.cardReviewLog.groupBy({
      by: ["completeness"],
      where: { userId, reviewAt: range },
      _count: true,
    }),
    db.readerArticleHighlight.count({
      where: { userId, createdAt: range },
    }),
    db.readerBookAnnotation.count({ where: { userId, createdAt: range } }),
    db.languageExchangeCall.groupBy({
      by: ["status"],
      where: { learnerId: userId, createdAt: range },
      _count: true,
    }),
  ]);
  return {
    speakingAnswers: {
      total: answers,
      correct,
      incorrect: answers - correct,
      accuracy: answers > 0 ? correct / answers : null,
    },
    writing: {
      submissions: writing._count,
      characters: writing._sum.submissionCharacterCount ?? 0,
    },
    reviewLogs: reviews.map((row) => ({
      coverage: row.completeness,
      count: row._count,
    })),
    highlightsCreated: {
      articles: articleHighlights,
      books: bookHighlights,
    },
    callsCreated: calls.map((row) => ({
      status: row.status,
      count: row._count,
    })),
  };
}

async function inventory(userId: string, now: number) {
  const [
    decks,
    activeCards,
    pausedCards,
    newCards,
    dueCards,
    articles,
    books,
  ] = await Promise.all([
    db.deck.count({ where: { userId } }),
    db.card.count({ where: { userId, paused: false } }),
    db.card.count({ where: { userId, paused: true } }),
    db.card.count({ where: { userId, paused: false, lastReview: 0 } }),
    db.card.count({ where: dueCardsWhere(userId, now) }),
    db.readerArticle.count({ where: { userId } }),
    db.readerBook.count({ where: { userId } }),
  ]);
  return {
    decks,
    activeCards,
    pausedCards,
    newCards,
    dueCards,
    articles,
    books,
  };
}

export async function getStudyOverview(
  userId: string,
  input: { from?: string; to?: string },
) {
  const now = new Date();
  const to = input.to ?? now.toISOString();
  const from =
    input.from ?? new Date(Date.parse(to) - 7 * 86400000).toISOString();
  const range = dateWhere({ from, to });
  const [periodActivity, currentInventory, settings] = await Promise.all([
    activity(userId, range),
    inventory(userId, now.getTime()),
    db.userSettings.findUnique({
      where: { userId },
      select: settingsSelect,
    }),
  ]);
  return {
    period: { from, to, endExclusive: true },
    activity: periodActivity,
    currentInventory: { asOf: now.toISOString(), ...currentInventory },
    settings,
    notes: [
      "Activity counts use all matching stored records, not the rolling report sample. Compare periods by calling this tool for each range.",
      "Quiz answers and scheduling review logs describe different events; do not add them as separate practice attempts. Accuracy is the recorded grader's judgment, not a proficiency score.",
      "Review log coverage can be partial. Passive reviews store only the latest timestamp per card. Reading positions and last-opened times are not a complete reading history or time-spent measurement.",
      "Inventory and settings reflect the current state, even when the activity period is historical. Writing corrections are saved model suggestions; practice mode and feedback bullets were not stored.",
    ],
  };
}

export function registerOverviewTool(server: McpServer, userId: string) {
  registerStudyTool(server, {
    name: "get_study_overview",
    title: "Get study activity and settings",
    description:
      "Get accurate activity totals for an explicit date range, plus current deck/card/reading inventory and study preferences. Defaults to the last seven days; dates include offsets, from is inclusive and to exclusive. Use for progress comparisons, study workload and settings-aware coaching. Search and fetch supporting records for examples. Current inventory is not a historical snapshot; no new activity is created by fetching.",
    input: z.object(dateFilters).strict(),
    run: (input) => getStudyOverview(userId, input),
  });
}
