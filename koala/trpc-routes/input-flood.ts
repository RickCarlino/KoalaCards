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

const MIN_FLOOD_COUNT = 3;
const MAX_FLOOD_COUNT = 5;

const SentenceSchema = z.object({ text: z.string(), en: z.string() });
const InputFloodSchema = z.object({
  language: z.string(),
  diagnosis: z.object({
    target_label: z.string(),
    contrast_label: z.string().nullable().optional(),
    why_error: z.string().max(240),
    rules: z.array(z.string()).min(2).max(5),
  }),
  flood: z.object({
    A: z.array(SentenceSchema).min(MIN_FLOOD_COUNT).max(MAX_FLOOD_COUNT),
    B: z
      .array(SentenceSchema)
      .min(MIN_FLOOD_COUNT)
      .max(MAX_FLOOD_COUNT)
      .nullable()
      .optional(),
  }),
  production: z
    .array(
      z.object({
        prompt_en: z.string(),
        answer: z.string(),
      }),
    )
    .min(5)
    .max(6),
  takeaways: z.array(z.string()).min(2).max(5),
  fix: z.object({ original: z.string(), corrected: z.string() }),
});

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
    .min(1)
    .max(6),
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
      lesson: InputFloodSchema,
      source: z.object({ quizResultId: z.number(), langCode: LANG_CODES }),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("Unauthorized");

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
        take: 100,
      });
      return draw(shuffle(results)) ?? null;
    };

    const result = await pickOne();
    if (!result) throw new Error("No wrong results found");

    const parsedLang = LANG_CODES.safeParse(result.langCode);
    if (!parsedLang.success) throw new Error("Unsupported language code");
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
      schema: InputFloodSchema,
      maxTokens: 12000,
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
  return `You are a language-teaching generator. Create an INPUT FLOOD exercise 
in ${language}.

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
- Expected (ground truth): ${definition}
- Learner's attempt: ${provided}
- Why wrong: ${reason}
- Language: ${language}

Output JSON ONLY, strictly matching schema below. All visible text 
must be ${language} except rules/diagnosis/takeaways (English). No 
transliteration. Sentences: short (≤12 words), high-frequency, 
everyday, idiomatic. Provide English translations in "en" fields. 
No duplicates; vary verbs and nouns (>=${MIN_FLOOD_COUNT} distinct verbs and nouns per section).

Tone:
corrective, concise.
Always speak directly to the learner as "you".
Do not say "The student" or similar.
Always explain in English.

Steps:
1. Diagnosis:  
   - target_label: short description of the needed form.  
   - contrast_label: valid but contrasting form (or null).  
   - why_error: brief rationale (≤240 chars).  
   - rules: 2-5 English bullet rules.  
2. Flood:  
   - A: ${MIN_FLOOD_COUNT}-${MAX_FLOOD_COUNT} example sentences with target form.  
   - B: ${MIN_FLOOD_COUNT}-${MAX_FLOOD_COUNT} contrasting examples OR null.  
3. Production: ${MIN_FLOOD_COUNT}-6 items. Each: English prompt + ${language} 
answer.  
4. Takeaways: 1-3 short English reminders.  
5. Fix: { original: ${provided}, corrected: ${definition} }.

Classification rule (internal, don't output):  
- give_up (“idk”, “몰라요”, etc.) => treat as no attempt. 
why_error = “You gave up. Correct form is X.” contrast_label = 
null unless explicit in reason. Model only target form.  
- off_language (not in ${language} / unrelated text) => Use give_up.
- totally_wrong (wrong meaning/form) => same as give_up.
- vocabulary => Misunderstanding of a specifc word or words.
  IF IT IS A VOCABULARY MISTAKE, MAKE SURE FLOOD.A and FLOOD.B
  CONTAIN THE VOCABULARY WORD(S) IN VARIOUS CONTEXTS.
- usage => Misunderstanding of a common collocation or usage pattern.
- form => Incorrect morphological form (tense, agreement, etc.).
- grammar => Nongrammatical speech or grammar pattern misunderstanding.
- answer => normal compare & contrast.  

STRICT COUNTS:
  flood.A = ${MIN_FLOOD_COUNT}-${MAX_FLOOD_COUNT};
  flood.B = ${MIN_FLOOD_COUNT}-${MAX_FLOOD_COUNT} or null;
  production = ${MIN_FLOOD_COUNT}-6.

Schema:
{
  "language": string,
  "diagnosis": {
    "target_label": string,
    "contrast_label": string | null,
    "why_error": string,
    "rules": string[]
  },
  // Don't add parenthesized notes - Just sentences with translations
  "flood": {
    "A": [{ "text": string, "en": string }],
    "B": [{ "text": string, "en": string }] | null
  },
  "production": [{ "prompt_en": string, "answer": string }],
  "takeaways": string[],
  "fix": { "original": string, "corrected": string }
}`;
}

export const inputFloodGrade = procedure
  .input(GradeRequestSchema)
  .output(GradeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const languageName =
      supportedLanguages[
        input.language as keyof typeof supportedLanguages
      ] || input.language;
    const items = input.items.slice(0, 6).map((it) => ({
      prompt_en: it.prompt_en.slice(0, 200),
      answer: it.answer.slice(0, 200),
      attempt: it.attempt.slice(0, 200),
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
      maxTokens: 1500,
    });

    return graded;
  });
