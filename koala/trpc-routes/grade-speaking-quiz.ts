import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
import { speaking } from "../quiz-evaluators/speaking";
import { prismaClient } from "../prisma-client";

export const gradeSpeakingQuiz = procedure
  .input(
    z.object({
      userInput: z.string(),
      quizID: z.number(),
    }),
  )
  .output(
    z.object({
      isCorrect: z.boolean(),
      feedback: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userID = (await getUserSettings(ctx.user?.id)).user.id;

    const quiz = await prismaClient.quiz.findFirst({
      where: {
        id: input.quizID,
      },
      include: {
        Card: true,
      },
    });

    if (!quiz) {
      throw new Error("Quiz not found");
    }

    if (quiz.Card.userId !== userID) {
      throw new Error("Not your card");
    }

    const result = await speaking({
      card: quiz.Card,
      quiz,
      userID,
      userInput: input.userInput,
    });

    return {
      isCorrect: result.result === "pass",
      feedback: result.userMessage,
    };
  });
