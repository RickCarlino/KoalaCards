import {
  generateStructuredOutput,
  type CoreMessage,
  type LanguageModelIdentifier,
} from "@/koala/ai";
import {
  FLOOD_ITEM_COUNT_MAX,
  FLOOD_ITEM_COUNT_MIN,
  INPUT_FLOOD_GENERATE_MAX_TOKENS,
  INPUT_FLOOD_GRADE_ITEMS_MAX,
  INPUT_FLOOD_GRADE_ITEMS_MIN,
  INPUT_FLOOD_GRADE_MAX_TOKENS,
  INPUT_FLOOD_GRADE_TEXT_LIMIT,
  INPUT_FLOOD_RECENT_RESULTS_TAKE,
  INPUT_FLOOD_SENTENCE_MAX_WORDS,
  INPUT_FLOOD_WHY_ERROR_MAX_CHARS,
  INPUT_FLOOD_PRODUCTION_MAX,
  INPUT_FLOOD_PRODUCTION_MIN,
  RULES_COUNT_MAX,
  RULES_COUNT_MIN,
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

const MULTIPASS_CONVERSATION_MODEL: LanguageModelIdentifier = [
  "openai",
  "fast",
];

const LESSON_CONVERSATION_SYSTEM_PROMPT = `You are a veteran Korean language coach. Speak in plain English when explaining issues, but supply Korean sentences whenever you give examples. Keep every Korean sentence natural, idiomatic, and at most ${INPUT_FLOOD_SENTENCE_MAX_WORDS} words. Never use romanization, brackets, emojis, or notes in Korean text. Address the learner directly as "you" whenever you describe their mistake in English.`;

const JSON_SCHEMA_SKELETON = `{
  "diagnosis": {
    "original": string,
    "corrected": string,
    "error_explanation": string,
    "rules": string[]
  },
  "flood": {
    "target": { "label": string, "items": [{ "text": string, "en": string }] },
    "contrast": { "label": string, "items": [{ "text": string, "en": string }] } | null
  },
  "production": [{ "prompt_en": string, "answer": string }]
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
    "Step 2 — Lesson recap:\n- Write ≤1 paragraph in English explaining the issue and the fix.\n- Add 1-2 Korean example sentences that model the corrected pattern.\n- Optionally add 0-2 contrastive Korean examples only if a different pattern is causing confusion. Keep all Korean sentences short, natural, and varied in vocab.",
    "Step 3 — Drills:\n- Create prompt/response pairs that force the corrected pattern. Prompts stay in English, answers in Korean.",
    "Step 4 — JSONization (return JSON ONLY):",
    JSON_SCHEMA_SKELETON,
    "Conversion guardrails:",
    `- Use the learner's exact attempt (${input.attempt}) as diagnosis.original.`,
    `- diagnosis.corrected must be a natural Korean sentence that actually expresses "${input.definition}" (or the corrected nuance you explained) and fits everyday speech.`,
    `- diagnosis.error_explanation must be short (under ${INPUT_FLOOD_WHY_ERROR_MAX_CHARS} characters), written in English, and speak directly to the learner ("You ...").`,
    `- diagnosis.rules must contain ${RULES_COUNT_MIN}-${RULES_COUNT_MAX} short English reminders that start with "You..." or otherwise address the learner in second person.`,
    `- flood.target.label should name the correct pattern. Provide ${FLOOD_ITEM_COUNT_MIN}-${FLOOD_ITEM_COUNT_MAX} target sentences; each items[].text is Korean only and ≤ ${INPUT_FLOOD_SENTENCE_MAX_WORDS} words, and items[].en is its natural English gloss.`,
    `- flood.contrast only exists if a clearly different-but-related pattern caused confusion. When used, include ${FLOOD_ITEM_COUNT_MIN}-${FLOOD_ITEM_COUNT_MAX} sentences that avoid the target pattern. Otherwise set it to null.`,
    `- production must include ${INPUT_FLOOD_PRODUCTION_MIN}-${INPUT_FLOOD_PRODUCTION_MAX} prompt/answer pairs. prompt_en stays in English, answer stays in Korean and highlights the corrected pattern.`,
    `- All Korean outputs (diagnosis.corrected, flood sentences, production answers) must avoid romanization, brackets, parenthetical notes, or English words unless they are proper nouns. Keep them short and natural.`,
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
    schema: InputFloodLessonSchema,
    maxTokens: INPUT_FLOOD_GENERATE_MAX_TOKENS,
  });
};

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
            ],
          },
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

    const lesson = await runLessonConversation({
      definition: result.definition,
      acceptableTerm: result.acceptableTerm,
      attempt: result.userInput,
      reason: result.reason,
    });

    return { lesson, source: { quizResultId: result.id, langCode } };
  });

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
