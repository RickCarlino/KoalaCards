import { prismaClient } from "@/koala/prisma-client";

export type QuizTermTrendRow = {
  term: string;
  definition: string;
  count: number;
};

type Params = {
  userId: string;
  limit?: number;
};

export async function getTopUnreviewedQuizTermTrends({
  userId,
  limit = 10,
}: Params): Promise<QuizTermTrendRow[]> {
  const grouped = await prismaClient.quizResult.groupBy({
    by: ["acceptableTerm"],
    where: {
      userId,
      reviewedAt: null,
    },
    _count: {
      acceptableTerm: true,
    },
    orderBy: {
      _count: {
        acceptableTerm: "desc",
      },
    },
    take: limit,
  });

  const rows = await Promise.all(
    grouped.map(async ({ acceptableTerm, _count }) => {
      const representative = await prismaClient.quizResult.findFirst({
        where: {
          userId,
          reviewedAt: null,
          acceptableTerm,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          definition: true,
        },
      });

      return {
        term: acceptableTerm,
        definition: representative?.definition ?? "",
        count: _count.acceptableTerm,
      };
    }),
  );

  return rows;
}
