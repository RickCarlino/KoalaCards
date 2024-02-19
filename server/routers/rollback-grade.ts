import { errorReport } from "@/utils/error-report";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";
import { timeUntil } from "@/utils/time-until";

export const rollbackGrade = procedure
  .input(
    z.object({
      id: z.number(),
      schedulingData: z.object({
        difficulty: z.number(),
        stability: z.number(),
        nextReview: z.number(),
      }),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    const quiz = await prismaClient.quiz.findUnique({
      where: {
        id: input.id,
        Card: {
          userId,
        },
      },
    });
    if (!quiz) {
      return errorReport("Quiz not found");
    }
    const data = {
      where: { id: input.id },
      data: {
        ...input.schedulingData,
        lapses: Math.max(quiz.lapses - 1, 0),
      },
    };
    console.log(
      `Rollback grade. Next review: ${timeUntil(data.data.nextReview)}`,
    );
    prismaClient.quiz.update(data);
  });
