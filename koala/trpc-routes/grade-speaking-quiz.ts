import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prismaClient } from "../prisma-client";
import { reviewGradeSchema } from "../quiz-evaluators/grade-buckets";
import { evaluateSpeakingResponse } from "../quiz-evaluators/speaking";
import { procedure } from "../trpc-procedure";

async function getOwnedCardForSpeaking(cardID: number, userID: string) {
  const card = await prismaClient.card.findUnique({
    where: { id: cardID },
    select: {
      term: true,
      definition: true,
      userId: true,
      Deck: { select: { name: true, description: true } },
    },
  });

  if (!card) {
    throw new Error("Card not found");
  }

  if (card.userId !== userID) {
    throw new Error("Not your card");
  }

  return {
    term: card.term,
    definition: card.definition,
    deckName: card.Deck?.name ?? null,
    deckDescription: card.Deck?.description ?? null,
  };
}

export const gradeSpeakingQuiz = procedure
  .input(
    z.object({
      userInput: z.string().trim().min(1).max(2000),
      cardID: z.number().int().positive(),
    }),
  )
  .output(
    z.object({
      grade: reviewGradeSchema,
      isCorrect: z.boolean(),
      feedback: z.string(),
      quizResultId: z.number().nullable(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Please log in.",
      });
    }
    const card = await getOwnedCardForSpeaking(input.cardID, userId);
    const evaluation = await evaluateSpeakingResponse({
      prompt: card.definition,
      possibleAnswer: card.term,
      response: input.userInput,
      deckName: card.deckName,
      deckDescription: card.deckDescription,
    });
    const { id } = await prismaClient.quizResult.create({
      data: {
        userId,
        acceptableTerm: card.term,
        definition: card.definition,
        userInput: input.userInput,
        isAcceptable: evaluation.isCorrect,
        grade: evaluation.grade,
        gradingSource: evaluation.gradingSource,
        gradingModel: evaluation.gradingModel,
        gradingConfidence: evaluation.gradingConfidence,
        gradingContext: {
          deckName: card.deckName,
          deckDescription: card.deckDescription,
        },
        reason: evaluation.feedback,
        eventType: "speaking-judgement",
      },
      select: { id: true },
    });

    return {
      grade: evaluation.grade,
      isCorrect: evaluation.isCorrect,
      feedback: evaluation.feedback,
      quizResultId: id,
    };
  });
