import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { gradeUtterance } from "../grammar";
import { LANG_CODES } from "../shared-types";

export const gradeUtteranceRoute = procedure
  .input(
    z.object({
      langCode: LANG_CODES,
      prompt_en: z.string().min(1).max(400),
      answer: z.string().min(1).max(400),
      attempt: z.string().min(1).max(400),
      eventType: z.string().optional(),
    }),
  )
  .output(
    z.object({
      isCorrect: z.boolean(),
      feedback: z.string(),
      quizResultId: z.number(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("Unauthorized");
    }
    const res = await gradeUtterance({
      term: input.answer,
      definition: input.prompt_en,
      userInput: input.attempt,
      userId,
      eventType: input.eventType || "corrective-drill-production",
    });
    return res;
  });
