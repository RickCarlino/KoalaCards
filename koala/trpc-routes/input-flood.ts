import { generateStructuredOutput } from "@/koala/ai";
import { buildInputFloodPrompt } from "@/koala/input-flood/prompt";
import {
  INPUT_FLOOD_GENERATE_MAX_TOKENS,
  INPUT_FLOOD_GRADE_ITEMS_MAX,
  INPUT_FLOOD_GRADE_ITEMS_MIN,
  INPUT_FLOOD_GRADE_MAX_TOKENS,
  INPUT_FLOOD_GRADE_TEXT_LIMIT,
  INPUT_FLOOD_RECENT_RESULTS_TAKE,
  InputFloodLessonSchema,
} from "@/koala/types/input-flood";
import { draw, shuffle } from "radash";
import { z } from "zod";
import { prismaClient } from "../prisma-client";
import {
  LANG_CODES,
  type LangCode,
  supportedLanguages,
} from "../shared-types";
import { procedure } from "../trpc-procedure";

const GradeRequestSchema = z.object({
  language: z.string(),
  items: z
    .array(
      z.object({
        prompt_en: z.string(),
        answer: z.string(),
        attempt: z.string().default(""),
      }),
    )
    .min(INPUT_FLOOD_GRADE_ITEMS_MIN)
    .max(INPUT_FLOOD_GRADE_ITEMS_MAX),
});

const GradeResponseSchema = z.object({
  grades: z.array(
    z.object({
      score: z.number(),
      feedback: z.string(),
    }),
  ),
});

export const inputFloodGenerate = procedure
  .input(z.object({ resultId: z.number().optional() }).optional())
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

    const resultIdInput = input?.resultId;

    const pickOne = async () => {
      if (typeof resultIdInput === "number") {
        return await prismaClient.quizResult.findUnique({
          where: {
            id: resultIdInput,
            userId,
          },
        });
      }
      const results = await prismaClient.quizResult.findMany({
        where: {
          userId,
          isAcceptable: false,
          reviewedAt: null,
          errorTag: {
            in: [
              "form",
              "syntax",
              "semantics",
              "orthography",
              "unnatural",
            ]
          }
        },
        orderBy: { createdAt: "desc" },
        take: INPUT_FLOOD_RECENT_RESULTS_TAKE,
      });
      return draw(shuffle(results)) ?? null;
    };

    const result = await pickOne();
    if (!result) {
      throw new Error("No wrong results found");
    }

    const langCode = "ko" as LangCode;

    const prompt = buildInputFloodPrompt({
      langCode,
      definition: result.definition,
      provided: result.userInput,
      reason: result.reason,
    });

    const lesson = await generateStructuredOutput({
      model: ["openai", "fast"],
      messages: [{ role: "user", content: prompt }],
      schema: InputFloodLessonSchema,
      maxTokens: INPUT_FLOOD_GENERATE_MAX_TOKENS,
    });

    return { lesson, source: { quizResultId: result.id, langCode } };
  });

// prompt builder moved to koala/input-flood/prompt for reuse

export const inputFloodGrade = procedure
  .input(GradeRequestSchema)
  .output(GradeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const languageName =
      supportedLanguages[
      input.language as keyof typeof supportedLanguages
      ] || input.language;
    const items = input.items
      .slice(0, INPUT_FLOOD_GRADE_ITEMS_MAX)
      .map((it) => ({
        prompt_en: it.prompt_en.slice(0, INPUT_FLOOD_GRADE_TEXT_LIMIT),
        answer: it.answer.slice(0, INPUT_FLOOD_GRADE_TEXT_LIMIT),
        attempt: it.attempt.slice(0, INPUT_FLOOD_GRADE_TEXT_LIMIT),
      }));

    const rubric = `You are grading short language speaking drills in ${languageName}.
Score each item on two criteria and output JSON only as { "grades": [{ "score": number, "feedback": string }, ...] } with the same order and length as the input.

Scoring (single numeric score 0-1):
- 1 = Semantically correct AND uses the target form appropriately.
- 0.5 = Meaning is acceptable but form is off, or vice versa.
- 0 = Incorrect meaning, ungrammatical, or wrong form.

Feedback: one short sentence in English, actionable and specific.
Never give feedback that is not 100% needed.
Any feedback that can be omitted should be omitted.
This is not an attempt at creating perfect translations to the target language either.
The focus is on correctly responding to the prompt, not nitpicking minor grammar/spacing/punctuation issues.
The student can't see the "answer" field and there are countless ways to say the same thing.
You cannot take away points for word choice or register as long as the response is natural and appropriate.
`;

    const userMsg = [
      rubric,
      `Items:`,
      JSON.stringify(items),
      `Return JSON ONLY.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const graded = await generateStructuredOutput({
      model: ["openai", "good"],
      messages: [{ role: "user", content: userMsg }],
      schema: GradeResponseSchema,
      maxTokens: INPUT_FLOOD_GRADE_MAX_TOKENS,
    });

    return graded;
  });
