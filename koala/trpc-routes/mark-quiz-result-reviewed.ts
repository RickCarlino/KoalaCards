import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { prismaClient } from "../prisma-client";

// Marks a QuizResult as reviewed by setting reviewedAt to now.
// Uses updateMany to enforce user ownership in the where clause.
export const markQuizResultReviewed = procedure
  .input(z.object({ resultId: z.number() }))
  .output(z.object({ success: z.literal(true) }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const { resultId } = input;

    const result = await prismaClient.quizResult.updateMany({
      where: { id: resultId, userId },
      data: { reviewedAt: new Date() },
    });

    if (result.count !== 1) {
      throw new Error("Quiz result not found");
    }

    return { success: true } as const;
  });
