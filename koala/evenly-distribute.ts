import { prismaClient } from "./prisma-client";

export function evenlyDistribute<
  T extends { [P in K]: number },
  K extends keyof T,
>(input: T[], key: K): T[] {
  const n = input.length;
  if (n < 3) {
    return input;
  }
  const copy = input.map((item) => ({ ...item }));
  copy.sort((a, b) => a[key] - b[key]);
  const values = copy.map((item) => item[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const step = range / (n - 1);
  for (let i = 0; i < n; i++) {
    copy[i][key] = Math.round(min + i * step) as T[K];
  }
  return copy;
}

export const eligibleForLeveling = async (userID: string) => {
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const all = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: userID,
        flagged: { not: true },
      },
      firstReview: {
        gt: Date.now() - ONE_WEEK,
      },
      nextReview: {
        lt: Date.now() + ONE_WEEK,
      },
      repetitions: {
        gte: 2,
      },
    },
    orderBy: [{ nextReview: "desc" }],
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
  const evenlyDistributed = evenlyDistribute(eligible, "nextReview");
  const updates = evenlyDistributed.map(({ id, nextReview }) => {
    return prismaClient.quiz.update({
      where: { id },
      data: { nextReview },
    });
  });
  await prismaClient.$transaction(updates);
};
