import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { reviewGradeSchema } from "../quiz-evaluators/grade-buckets";
import {
  explainReviewResponse,
  reviewExplanationSchema,
} from "../quiz-evaluators/explanation";

const contextSchema = z.object({
  deckName: z.string().nullable().optional(),
  deckDescription: z.string().nullable().optional(),
});

function requireDecisionGrade(result: {
  grade: string | null;
  gradingSource: string | null;
}) {
  const grade = reviewGradeSchema.safeParse(result.grade);
  if (result.gradingSource !== "openai-decisions" || !grade.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This review does not support an explanation.",
    });
  }
  return grade.data;
}

export const explainQuizResult = procedure
  .input(z.object({ resultId: z.number().int().positive() }))
  .output(reviewExplanationSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Please log in.",
      });
    }
    const result = await prismaClient.quizResult.findFirst({
      where: {
        id: input.resultId,
        userId,
        eventType: "speaking-judgement",
      },
      select: {
        id: true,
        definition: true,
        acceptableTerm: true,
        userInput: true,
        grade: true,
        gradingSource: true,
        gradingContext: true,
        explanation: true,
      },
    });
    if (!result) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Review result not found.",
      });
    }
    const grade = requireDecisionGrade(result);
    if (result.explanation) {
      return { explanation: result.explanation };
    }

    const requestedAt = new Date();
    const snapshot = {
      id: result.id,
      userId,
      definition: result.definition,
      acceptableTerm: result.acceptableTerm,
      userInput: result.userInput,
      grade: result.grade,
      gradingSource: result.gradingSource,
    };
    const claim = await prismaClient.quizResult.updateMany({
      where: {
        ...snapshot,
        explanation: null,
        OR: [
          { explanationRequestedAt: null },
          {
            explanationRequestedAt: {
              lt: new Date(requestedAt.getTime() - 120_000),
            },
          },
        ],
      },
      data: { explanationRequestedAt: requestedAt },
    });
    if (claim.count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An explanation is already loading. Try again shortly.",
      });
    }

    const lease = {
      id: result.id,
      userId,
      explanationRequestedAt: requestedAt,
    };
    try {
      const context = contextSchema.parse(result.gradingContext ?? {});
      const explanation = await explainReviewResponse(
        {
          prompt: result.definition,
          possibleAnswer: result.acceptableTerm,
          response: result.userInput,
          ...context,
        },
        grade,
      );
      const saved = await prismaClient.quizResult.updateMany({
        where: { ...snapshot, ...lease },
        data: {
          explanation: explanation.explanation,
          explanationRequestedAt: null,
        },
      });
      if (saved.count !== 1) {
        throw new Error("Review changed during explanation");
      }
      return explanation;
    } catch (error) {
      await prismaClient.quizResult.updateMany({
        where: lease,
        data: { explanationRequestedAt: null },
      });
      console.error("Review explanation failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not load the explanation. Please try again.",
      });
    }
  });
