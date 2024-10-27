import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
import { speaking } from "../quiz-evaluators/speaking";
import { prismaClient } from "../prisma-client";

export const gradeSpeakingQuiz = procedure
  .input(
    z.object({
      userInput: z.string(),
      cardId: z.number(),
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

    const card = await prismaClient.card.findUnique({
      where: { id: input.cardId, userId: userID },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    const quiz = await prismaClient.quiz.findFirst({
      where: {
        cardId: card.id,
        quizType: "speaking",
      },
    });

    if (!quiz) {
      throw new Error("Quiz not found");
    }

    const result = await speaking({
      card,
      quiz,
      userID,
      userInput: input.userInput,
    });

    return {
      isCorrect: result.result === "pass",
      feedback: result.userMessage,
    };
  });
