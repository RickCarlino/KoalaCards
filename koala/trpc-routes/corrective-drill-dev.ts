import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { LANG_CODES } from "../shared-types";
import { buildCorrectiveDrillPrompt } from "@/koala/corrective-drill/prompt";
import { generateStructuredOutput } from "@/koala/ai";
import { CorrectiveDrillLessonSchema } from "@/koala/types/corrective-drill";

export const correctiveDrillGenerateDev = procedure
  .input(
    z.object({
      langCode: LANG_CODES,
      definition: z.string().min(1),
      provided: z.string().min(1),
      reason: z.string().min(1),
    }),
  )
  .output(
    z.object({
      lesson: CorrectiveDrillLessonSchema,
      source: z.object({ quizResultId: z.number(), langCode: LANG_CODES }),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("Unauthorized");
    }
    const prompt = buildCorrectiveDrillPrompt({
      langCode: input.langCode,
      definition: input.definition,
      provided: input.provided,
      reason: input.reason,
    });
    const lesson = await generateStructuredOutput({
      model: ["openai", "fast"],
      messages: [{ role: "user", content: prompt }],
      schema: CorrectiveDrillLessonSchema,
    });
    return {
      lesson,
      source: { quizResultId: 0, langCode: input.langCode },
    };
  });
