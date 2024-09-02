import { errorReport } from "./error-report";
import { prismaClient } from "./prisma-client";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

export function evenlyDistribute<
  T extends { [P in K]: number },
  K extends keyof T,
>(input: T[], key: K, min: number, max: number): T[] {
  const n = input.length;
  if (n < 3) {
    return input;
  }
  if (min > max) {
    return errorReport("min must be less than max");
  }
  const copy = input.map((item) => ({ ...item }));
  copy.sort((a, b) => a[key] - b[key]);
  const range = max - min;
  const step = range / (n - 1);
  for (let i = 0; i < n; i++) {
    copy[i][key] = Math.round(min + i * step) as T[K];
  }
  return copy;
}

export const eligibleForLeveling = async (userID: string) => {
  const all = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: userID,
        flagged: { not: true },
      },
      firstReview: {
        gt: 0,
        lt: Date.now() - ONE_DAY * 2,
      },
      nextReview: {
        lt: Date.now() + ONE_WEEK,
      },
      repetitions: {
        gte: 1,
      },
    },
    orderBy: [{ nextReview: "asc" }],
    take: 1000,
  });

  return all.filter((quiz) => {
    return quiz.repetitions - quiz.lapses > 2;
  });
};

export const levelReviews = async (userID: string) => {
  const eligible = (await eligibleForLeveling(userID)).map((quiz) => ({
    id: quiz.id,
    nextReview: quiz.nextReview,
  }));
  const now = Date.now();
  const later = now + ONE_WEEK;
  const evenlyDistributed = evenlyDistribute(
    eligible,
    "nextReview",
    now,
    later,
  );
  const updates = evenlyDistributed.map(({ id, nextReview }) => {
    return prismaClient.quiz.update({
      where: { id },
      data: { nextReview },
    });
  });
  const result = await prismaClient.$transaction(updates);
  return result.length;
};
