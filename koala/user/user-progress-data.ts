import { prismaClient } from "@/koala/prisma-client";
import { getLessonMeta } from "@/koala/trpc-routes/get-next-quizzes";
import {
  addDaysMs,
  addMonths,
  dateKeysInclusive,
  formatDateKey,
  startOfDay,
  subtractDaysMs,
} from "@/koala/user/date";
import { ChartDataPoint, QuickStat } from "@/koala/user/types";

function cumulativeSeriesFromDailyTotals(
  dateKeys: readonly string[],
  dailyTotals: Readonly<Record<string, number>>,
): ChartDataPoint[] {
  let runningTotal = 0;
  return dateKeys.map((date) => {
    runningTotal += dailyTotals[date] ?? 0;
    return { date, count: runningTotal };
  });
}

function cumulativeSeriesFromEvents<T>(params: {
  dateKeys: readonly string[];
  events: readonly T[];
  getDate: (event: T) => Date;
  getAmount: (event: T) => number;
}): ChartDataPoint[] {
  const dailyTotals: Record<string, number> = Object.fromEntries(
    params.dateKeys.map((key) => [key, 0]),
  );

  for (const event of params.events) {
    const key = formatDateKey(params.getDate(event));
    const currentTotal = dailyTotals[key];
    if (typeof currentTotal === "number") {
      dailyTotals[key] = currentTotal + params.getAmount(event);
    }
  }

  return cumulativeSeriesFromDailyTotals(params.dateKeys, dailyTotals);
}

async function countNewCardsSince(userId: string, sinceMs: number) {
  const rows = await prismaClient.card.findMany({
    select: { id: true },
    where: { userId, firstReview: { gte: sinceMs } },
    distinct: ["id"],
  });
  return rows.length;
}

export async function getUserProgressData(params: {
  userId: string;
  cardsPerDayMax: number;
}): Promise<{
  quickStats: QuickStat[];
  cardChartData: ChartDataPoint[];
  writingChartData: ChartDataPoint[];
}> {
  const now = new Date();
  const yesterdayMs = subtractDaysMs(now, 1);
  const oneWeekAgoMs = subtractDaysMs(now, 7);
  const tomorrowMs = addDaysMs(now, 1);

  const chartStart = startOfDay(addMonths(now, -3));
  const chartEnd = now;
  const dateKeys = dateKeysInclusive(chartStart, chartEnd);

  const baseCardWhere = { userId: params.userId, flagged: { not: true } };

  const [
    lessonMeta,
    cardsDueNext24Hours,
    uniqueCardsLast24Hours,
    uniqueCardsLastWeek,
    newCardsLast24Hours,
    newCardsLastWeek,
    globalUsers,
    learnedCards,
    writingSubmissions,
  ] = await Promise.all([
    getLessonMeta(params.userId),
    prismaClient.card.count({
      where: {
        ...baseCardWhere,
        nextReview: { lt: tomorrowMs },
        firstReview: { gt: 0 },
      },
    }),
    prismaClient.card.count({
      where: { ...baseCardWhere, lastReview: { gte: yesterdayMs } },
    }),
    prismaClient.card.count({
      where: { ...baseCardWhere, lastReview: { gte: oneWeekAgoMs } },
    }),
    countNewCardsSince(params.userId, yesterdayMs),
    countNewCardsSince(params.userId, oneWeekAgoMs),
    prismaClient.user.count(),
    prismaClient.card.findMany({
      where: {
        userId: params.userId,
        firstReview: { gte: chartStart.getTime() },
      },
      select: { firstReview: true },
    }),
    prismaClient.writingSubmission.findMany({
      where: { userId: params.userId, createdAt: { gte: chartStart } },
      select: { createdAt: true, correctionCharacterCount: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const weeklyTarget = params.cardsPerDayMax * 7;
  const learnedWithFirstReview = learnedCards.filter(
    (card): card is { firstReview: number } =>
      typeof card.firstReview === "number",
  );

  const cardChartData = cumulativeSeriesFromEvents({
    dateKeys,
    events: learnedWithFirstReview,
    getDate: (card) => new Date(card.firstReview),
    getAmount: () => 1,
  });

  const writingChartData = cumulativeSeriesFromEvents({
    dateKeys,
    events: writingSubmissions,
    getDate: (submission) => submission.createdAt,
    getAmount: (submission) => submission.correctionCharacterCount,
  });

  const quickStats: QuickStat[] = [
    { label: "Total cards", value: lessonMeta.totalCards },
    { label: "New cards in deck", value: lessonMeta.newCards },
    { label: "Cards due now", value: lessonMeta.quizzesDue },
    { label: "Cards due next 24 hours", value: cardsDueNext24Hours },
    {
      label: "New cards studied last 24 hours",
      value: newCardsLast24Hours,
    },
    {
      label: "New cards studied this week",
      value: `${newCardsLastWeek} / ${weeklyTarget}`,
    },
    {
      label: "Cards studied last 24 hours",
      value: uniqueCardsLast24Hours,
    },
    { label: "Cards studied this week", value: uniqueCardsLastWeek },
    { label: "Active Koala users", value: globalUsers },
  ];

  return { quickStats, cardChartData, writingChartData };
}
