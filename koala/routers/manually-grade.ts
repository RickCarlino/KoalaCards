import { errorReport } from "@/koala/error-report";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { setGrade } from "./import-cards";

export const manuallyGrade = procedure
  .input(
    z.object({
      id: z.number(),
      grade: z.number(),
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
    await setGrade(quiz, input.grade);
  });
