import {
  generateStructuredOutput,
  type CoreMessage,
  type LanguageModelIdentifier,
} from "@/koala/ai";
import {
  CORRECTIVE_DRILL_GENERATE_MAX_TOKENS,
  CORRECTIVE_DRILL_RECENT_RESULTS_TAKE,
  CORRECTIVE_DRILL_SENTENCE_MAX_WORDS,
  CORRECTIVE_DRILL_ERROR_MAX_CHARS,
  CorrectiveDrillLessonSchema,
} from "@/koala/types/corrective-drill";
import { draw, shuffle } from "radash";
import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { LANG_CODES, type LangCode } from "../shared-types";
import { procedure } from "../trpc-procedure";

const MULTIPASS_CONVERSATION_MODEL: LanguageModelIdentifier = [
  "openai",
  "fast",
];

const LESSON_CONVERSATION_SYSTEM_PROMPT = `You are a veteran Korean language coach. Speak in plain English when explaining issues, but supply Korean sentences whenever you give examples. Keep every Korean sentence natural, idiomatic, and at most ${CORRECTIVE_DRILL_SENTENCE_MAX_WORDS} words. Never use romanization, brackets, emojis, or notes in Korean text. Address the learner directly as "you" whenever you describe their mistake in English.`;

const JSON_SCHEMA_SKELETON = `{
  "diagnosis": {
    "original": string,
    "corrected": string,
    "error_explanation": string
  },
  "target": { "label": string, "example": { "text": string, "en": string } },
  "contrast": { "label": string, "example": { "text": string, "en": string } } | null,
  "production": { "prompt_en": string, "answer": string }
}`;

type ConversationInput = {
  definition: string;
  acceptableTerm: string;
  attempt: string;
  reason: string;
};

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const prepareConversationInput = (
  input: ConversationInput,
): ConversationInput => ({
  definition: normalizeWhitespace(input.definition),
  acceptableTerm: normalizeWhitespace(input.acceptableTerm),
  attempt: normalizeWhitespace(input.attempt),
  reason: normalizeWhitespace(input.reason),
});
const buildConversationPrompt = (input: ConversationInput): string => {
  const reasonLine = input.reason
    ? `Coaching note: ${input.reason}. Hit this directly in your lesson.`
    : "";
  const errorLine = input.reason
    ? `The issue we logged was: ${input.reason}.`
    : "Address the underlying issue directly in every section.";

  return [
    "We are simulating a short back-and-forth like the example conversation. Think through these mini-steps quickly and then convert everything to JSON.",
    "Step 1 — Rate the learner:\n- Prompt in English:"
      .concat(` ${input.definition}`)
      .concat(` (acceptable response: ${input.acceptableTerm}).`)
      .concat(` Learner replied: ${input.attempt}.`)
      .concat(
        " Pick 1-4 from the rubric (correct, incomplete/unrelated, grammatical issue, wrong word) and note why in one English sentence addressing the learner.",
      ),
    "Step 2 — Lesson recap:\n- Write ≤1 paragraph in English explaining the issue and the fix.\n- Add exactly 1 Korean example sentence that models the corrected pattern.\n- Optionally add 1 contrastive Korean example only if a different pattern is causing confusion. Keep all Korean sentences short, natural, and varied in vocab.",
    "Step 3 — Drills:\n- Create 1 prompt/response pair that forces the corrected pattern. Prompt stays in English, answer in Korean.",
    "Step 4 — JSONization (return JSON ONLY):",
    JSON_SCHEMA_SKELETON,
    "Conversion guardrails:",
    `- Use the learner's exact attempt (${input.attempt}) as diagnosis.original.`,
    `- diagnosis.corrected must be a natural Korean sentence that actually expresses "${input.definition}" (or the corrected nuance you explained) and fits everyday speech.`,
    `- diagnosis.error_explanation must be short (under ${CORRECTIVE_DRILL_ERROR_MAX_CHARS} characters), written in English, and speak directly to the learner ("You ...").`,
    `- target.label should name the correct pattern. Provide 1 target sentence in target.example.text (Korean only, ≤ ${CORRECTIVE_DRILL_SENTENCE_MAX_WORDS} words) with its natural English gloss in target.example.en.`,
    `- contrast only exists if a clearly different-but-related pattern caused confusion. When used, include exactly 1 sentence in contrast.example that avoids the target pattern. Otherwise set it to null.`,
    `- production must include exactly 1 prompt/answer pair. prompt_en stays in English, answer stays in Korean and highlights the corrected pattern.`,
    `- All Korean outputs (diagnosis.corrected, target/contrast sentences, production answers) must avoid romanization, brackets, parenthetical notes, or English words unless they are proper nouns. Keep them short and natural.`,
    `- ${errorLine}`,
    `- Use ${input.acceptableTerm} as the reference for what a good answer sounded like, but you can adjust wording to keep it natural and idiomatic.`,
    `- ${reasonLine}`,
    "Return JSON ONLY with double quotes and zero commentary.",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const runLessonConversation = async (rawInput: ConversationInput) => {
  const input = prepareConversationInput(rawInput);
  const conversation: CoreMessage[] = [
    { role: "system", content: LESSON_CONVERSATION_SYSTEM_PROMPT },
    { role: "user", content: buildConversationPrompt(input) },
  ];

  return generateStructuredOutput({
    model: MULTIPASS_CONVERSATION_MODEL,
    messages: conversation,
    schema: CorrectiveDrillLessonSchema,
    maxTokens: CORRECTIVE_DRILL_GENERATE_MAX_TOKENS,
  });
};

export const correctiveDrillGenerate = procedure
  .input(z.object({ resultId: z.number().optional() }).optional())
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
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: CORRECTIVE_DRILL_RECENT_RESULTS_TAKE,
      });
      return draw(shuffle(results)) ?? null;
    };

    const result = await pickOne();
    if (!result) {
      throw new Error("No wrong results found");
    }

    const langCode = "ko" as LangCode;

    const lesson = await runLessonConversation({
      definition: result.definition,
      acceptableTerm: result.acceptableTerm,
      attempt: result.userInput,
      reason: result.reason,
    });

    return { lesson, source: { quizResultId: result.id, langCode } };
  });
