import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { prismaClient } from "../prisma-client";
import {
  LANG_CODES,
  type LangCode,
  supportedLanguages,
} from "../shared-types";
import { shuffle, draw } from "radash";
import { generateStructuredOutput } from "@/koala/ai";
import {
  InputFloodLessonSchema,
  FLOOD_ITEM_COUNT_MAX,
  FLOOD_ITEM_COUNT_MIN,
  INPUT_FLOOD_SENTENCE_MAX_WORDS,
  INPUT_FLOOD_WHY_ERROR_MAX_CHARS,
  INPUT_FLOOD_PROMPT_RULES_MIN,
  INPUT_FLOOD_PROMPT_RULES_MAX,
  INPUT_FLOOD_PRODUCTION_MIN,
  INPUT_FLOOD_PRODUCTION_MAX,
  INPUT_FLOOD_RECENT_RESULTS_TAKE,
  INPUT_FLOOD_GENERATE_MAX_TOKENS,
  INPUT_FLOOD_GRADE_MAX_TOKENS,
  INPUT_FLOOD_GRADE_ITEMS_MIN,
  INPUT_FLOOD_GRADE_ITEMS_MAX,
  INPUT_FLOOD_GRADE_TEXT_LIMIT,
} from "@/koala/types/input-flood";

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

    const parsedLang = LANG_CODES.safeParse(result.langCode);
    if (!parsedLang.success) {
      throw new Error("Unsupported language code");
    }
    const langCode = parsedLang.data as LangCode;

    const prompt = buildInputFloodPrompt({
      langCode,
      definition: result.definition,
      provided: result.userInput,
      reason: result.reason,
    });

    const lesson = await generateStructuredOutput({
      model: ["openai", "cheap"],
      messages: [{ role: "user", content: prompt }],
      schema: InputFloodLessonSchema,
      maxTokens: INPUT_FLOOD_GENERATE_MAX_TOKENS,
    });

    return { lesson, source: { quizResultId: result.id, langCode } };
  });

type PromptParams = {
  langCode: LangCode;
  definition: string;
  provided: string;
  reason: string;
};

function buildInputFloodPrompt({
  langCode,
  definition,
  provided,
  reason,
}: PromptParams): string {
  const language = supportedLanguages[langCode];
  return `You are a language-teaching generator. Create an INPUT FLOOD exercise in ${language}.

Background:

Input flood = saturating comprehensible input with many 
natural examples of a target form so learners internalize it through 
frequency and use it correctly. Support: Krashen's Input Hypothesis 
(i+1), Ellis/Tomasello usage-based accounts, studies (Trahey & White 
1993; Doughty & Varela 1998; Hernández 2008; Han et al. 2008). 
Benefits: implicit learning, lower cognitive load, durable retention, 
engagement, broad accessibility, supports noticing. Often paired with 
input enhancement, narrow reading, processing instruction, structural 
priming.

Task: Based on the data:
- Expected meaning in English: ${definition}
- Learner's attempt in ${language}: ${provided}
- Why they are wrong: ${reason}

Output JSON ONLY, strictly matching the schema. All learner-facing text must be ${language} except rules/diagnosis (English). No transliteration.
Sentences must be short (≤${INPUT_FLOOD_SENTENCE_MAX_WORDS} words), high-frequency, everyday, and idiomatic. Provide English translations in "en" fields.
No duplicates; vary verbs and nouns (>=${FLOOD_ITEM_COUNT_MIN} distinct verbs and nouns per section).

How it is used (important):
- flood.target and flood.contrast sentences are shown directly to learners and used verbatim in flashcards. Speech to text (TTS) voices will read them aloud.
- Therefore, flood entries must be ONLY the sentence (field "text") and its English translation (field "en").
- Do NOT add parenthetical explanations, labels, grammar tags, notes, romanization, or bracketed content in either field.
- Do NOT wrap sentences in quotes. Do NOT include emojis or placeholders.
- The learner's incorrect sentence must NOT appear unless corrected; only include correct sentences.

Validity rules:
- flood.target: every sentence must exemplify the target form indicated by flood.target.label and be grammatical.
- flood.contrast: if included, every sentence must exemplify the contrasting form indicated by flood.contrast.label and must NOT use the target form.
  If there is no clear contrasting form, set flood.contrast = null.
- If the issue is vocabulary or usage, include the relevant word(s) in varied, grammatical contexts within flood.target (and flood.contrast if included).

Tone:
corrective, concise.
Always speak directly to the learner as "you".
Do not say "The student" or similar.
Always explain in English.

Steps:
1. Diagnosis:  
   - original: the learner's attempt (${provided}).  
   - corrected: one natural sentence in ${language} that correctly expresses the expected meaning (no English).  
   - error_explanation: brief rationale (≤${INPUT_FLOOD_WHY_ERROR_MAX_CHARS} chars).  
   - rules: ${INPUT_FLOOD_PROMPT_RULES_MIN}-${INPUT_FLOOD_PROMPT_RULES_MAX} English bullet rules.  
2. Flood:
   - target: label of the target form and ${FLOOD_ITEM_COUNT_MIN}-${FLOOD_ITEM_COUNT_MAX} example sentences in items[].  
   - contrast: label of the contrasting form and ${FLOOD_ITEM_COUNT_MIN}-${FLOOD_ITEM_COUNT_MAX} example sentences in items[] OR null.
3. Production: ${INPUT_FLOOD_PRODUCTION_MIN}-${INPUT_FLOOD_PRODUCTION_MAX} items. Each: English prompt + ${language} answer.

Classification rule (internal, don't output):  
- give_up (“idk”, “몰라요”, etc.) => treat as no attempt. 
error_explanation = “You gave up. Correct form is X.”
If a clear contrasting form is explicit in the reason, include flood.contrast with an appropriate label; otherwise set flood.contrast = null. Model only the target form in flood.target.
- off_language (not in ${language} / unrelated text) => Use give_up.
- totally_wrong (wrong meaning/form) => same as give_up.
- vocabulary => Misunderstanding of a specifc word or words.
  IF IT IS A VOCABULARY MISTAKE, MAKE SURE FLOOD.TARGET and FLOOD.CONTRAST
  CONTAIN THE VOCABULARY WORD(S) IN VARIOUS CONTEXTS.
  GRAMMATICALLY CORRECT SENTENCES ONLY!
- usage => Misunderstanding of a common collocation or usage pattern.
- form => Incorrect morphological form (tense, agreement, etc.).
- grammar => Nongrammatical speech or grammar pattern misunderstanding.
- answer => normal compare & contrast.  

STRICT COUNTS:
  flood.target.items = ${FLOOD_ITEM_COUNT_MIN}-${FLOOD_ITEM_COUNT_MAX};
  flood.contrast.items = ${FLOOD_ITEM_COUNT_MIN}-${FLOOD_ITEM_COUNT_MAX} or null;
  production = ${INPUT_FLOOD_PRODUCTION_MIN}-${INPUT_FLOOD_PRODUCTION_MAX}.

Schema:
{
  "diagnosis": {
    "original": string,
    "corrected": string,
    "error_explanation": string,
    "rules": string[]
  },
  // flood entries are used verbatim in study cards — DO NOT add parenthesized/bracketed notes, quotes, emojis, or explanations
  "flood": {
    "target": { "label": string, "items": [{ "text": string, "en": string }] },
    "contrast": { "label": string, "items": [{ "text": string, "en": string }] } | null
  },
  "production": [{ "prompt_en": string, "answer": string }]
}`;
}

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
      model: ["openai", "cheap"],
      messages: [{ role: "user", content: userMsg }],
      schema: GradeResponseSchema,
      maxTokens: INPUT_FLOOD_GRADE_MAX_TOKENS,
    });

    return graded;
  });
