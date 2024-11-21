import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { setGrade } from "./import-cards";
import { maybeAddImages } from "../image";
import { Grade } from "femto-fsrs";

export const gradeQuiz = procedure
  .input(
    z.object({
      perceivedDifficulty: z.number().min(1).max(4).int(),
      quizID: z.number(),
    }),
  )
  .output(z.object({}))
  .mutation(async (x): Promise<{}> => {
    const user = x.ctx.user;
    if (!user) {
      return {
        rejectionText: "You are not logged in",
        result: "error",
      };
    }

    const grade = x.input.perceivedDifficulty as Grade;
    const quiz = await prismaClient.quiz.findUnique({
      where: {
        id: x.input.quizID,
        Card: {
          userId: user.id,
        },
      },
      include: {
        Card: true,
      },
    });

    if (!quiz) {
      return {
        result: "error",
        rejectionText: "No quiz found",
      };
    }

    if ([Grade.AGAIN, Grade.HARD].includes(grade)) {
      maybeAddImages(user.id, 1);
    }
    await setGrade(quiz, grade);
    return {};
  });
