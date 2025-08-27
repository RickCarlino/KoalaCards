import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
import { speaking } from "../quiz-evaluators/speaking-evaluator";
import { prismaClient } from "../prisma-client";

export const gradeSpeakingQuiz = procedure
  .input(z.object({ userInput: z.string(), cardID: z.number() }))
  .output(
    z.object({
      isCorrect: z.boolean(),
      feedback: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userID = (await getUserSettings(ctx.user?.id)).user.id;

    const card = await prismaClient.card.findUnique({
      where: { id: input.cardID },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    if (card.userId !== userID) {
      throw new Error("Not your card");
    }

    const result = await speaking({
      card,
      userID,
      userInput: input.userInput,
    });

    return {
      isCorrect: result.result === "pass",
      feedback: result.userMessage,
    };
  });
