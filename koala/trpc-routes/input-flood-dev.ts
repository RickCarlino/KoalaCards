import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { LANG_CODES } from "../shared-types";
import { buildInputFloodPrompt } from "@/koala/input-flood/prompt";
import { generateStructuredOutput } from "@/koala/ai";
import { InputFloodLessonSchema } from "@/koala/types/input-flood";

export const inputFloodGenerateDev = procedure
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
      lesson: InputFloodLessonSchema,
      source: z.object({ quizResultId: z.number(), langCode: LANG_CODES }),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("Unauthorized");
    }
    const prompt = buildInputFloodPrompt({
      langCode: input.langCode,
      definition: input.definition,
      provided: input.provided,
      reason: input.reason,
    });
    const lesson = await generateStructuredOutput({
      model: ["openai", "fast"],
      messages: [{ role: "user", content: prompt }],
      schema: InputFloodLessonSchema,
    });
    return {
      lesson,
      source: { quizResultId: 0, langCode: input.langCode },
    };
  });
