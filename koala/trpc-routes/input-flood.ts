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

// Local Zod schemas for prototype
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
    A: z.array(SentenceSchema).min(10).max(12),
    B: z.array(SentenceSchema).nullable().optional(),
  }),
  paragraph: z.string(),
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
        const r = await prismaClient.quizResult.findUnique({
          where: { id: resultIdInput },
        });
        if (!r || r.userId !== userId) return null;
        return r;
      }
      const results = await prismaClient.quizResult.findMany({
        where: { userId, isAcceptable: false },
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

// Local prompt builder to keep prototype self-contained
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
  return `Input flood is an SLA technique that saturates comprehensible input 
with many natural occurrences of a target form so learners 
internalize it through repeated, meaningful exposure and later 
produce it accurately. It aligns with Krashen's Input Hypothesis 
(i+1) and usage-based accounts (Ellis; Tomasello), where frequency 
and distribution drive entrenchment and implicit grammar; 
frequency-based exposure can outperform metalinguistic explanation 
(Ellis, 2005). Studies report gains across structures and 
settings—adverb placement (Trahey & White, 1993), past tense with 
interaction/feedback (Doughty & Varela, 1998), Spanish subjunctive 
via reading/listening (Hernández, 2008), and relative clauses/tense 
(Han, Park & Combs, 2008)—with immediate and delayed effects. 
Benefits include support for implicit learning (Hulstijn), lower 
cognitive load (Sweller), durable retention, higher engagement via 
authentic texts, broad level accessibility, and better noticing. 
Input flood synergizes with input enhancement, narrow 
reading/listening, processing instruction, and structural priming. In 
EPI (Extensive Processing Instruction), it is sequenced through 
sentence builders, L.A.M. (listening-as-modelling), narrow texts, and 
retrieval-based repetition to lay multiple memory traces before 
output; paired with purposeful output, it serves as a backbone for 
building fluency, accuracy, and long-term retention.

You are a language-teaching generator. Create a concise, 
mistake-driven INPUT FLOOD exercise in ${language} using the four 
fields below:

- Expected answer (ground truth): ${definition}
- Learner's attempt: ${provided}
- Why it's wrong (teacher rationale): ${reason}
- Language: ${language}

Your job:
1) Diagnose the core FORM difference between ${definition} and 
${provided}. Boil it down to a short target label (e.g., “every-X 
adverbial (no postposition)”) and, if applicable, a nearby 
contrasting frame that learners confuse (e.g., “per-X pattern with 
postposition”).
2) Write simple, natural sentences that repeatedly model the target 
form (“Input Flood A”) and, when appropriate, also model the 
contrasting-but-valid form (“Input Flood B”) so the learner 
learns when to use each.
3) Add one short, narrow paragraph (~3-5 sentences) naturally 
containing the target form.
4) Add 5 quick production prompts (English prompts; target-language 
answers).

Constraints:
- All learner-visible strings must be in ${language}, but provide an 
English translation for each sentence as an "en" field alongside the 
target-language "text".
- These must be real, native-quality example sentences in 
${language}, not literal translations of English prompts or phrases.
- All instructions/explanations (diagnosis text, labels, rules, and 
takeaways) must be in English.
- Keep sentences short, high-frequency, and everyday; aim for ≤ 12 
words.
- Vary verbs, nouns, and numbers; avoid near-duplicates.
 - Use natural, idiomatic style appropriate for the target language; 
do not include romanization.
 - If the target language normally uses a non-Latin script, DO NOT 
provide transliterations.
- Reflect the semantic domain hinted by ${definition}/${provided} 
(e.g., exercise) but keep content general and appropriate.
- No meta commentary; output JSON ONLY matching the schema below.
- Direct commentary to the student. Don't say "Learner said X 
incorrectly"; instead, say "You said X incorrectly."

STRICT BEHAVIOR RULES (Meta-Prompting):
1) Attempt classification (internal): Before generating, classify the learner's attempt into one of:
   - give_up: "I don't know", "idk", "no idea", "pass/skip", Korean "몰라요/모르겠어요", Spanish "no sé/ni idea", Japanese "わからない/知らない", Chinese "不知道", punctuation-only, or empty.
   - off_language/non_answer: text not in the target language or general chatter not addressing the prompt.
   - answer: an actual attempt to answer in the target language.
   You DO NOT output this classification; just use it to guide behavior below.

2) If give_up or off_language/non_answer:
   - Do NOT analyze the semantics of the attempt and do NOT explain what "I don't know" means.
   - Treat it as "no attempt provided". Base your diagnosis on the expected answer and the teacher rationale only.
   - In diagnosis.why_error, say succinctly that the student gave up or did not attempt, then state what form is needed.
   - In diagnosis.contrast_label: prefer null unless the reason indicates a specific contrasting valid form; do not invent a contrast based on the give-up phrase.
   - In drills and flood: model the target form; do NOT include give-up phrases.

3) If answer:
   - Proceed normally: contrast TARGET vs learner's attempt.

4) Always keep tone concise and corrective; avoid meta commentary.

Counts (strict):
- flood.A: 10-12 sentences (never fewer than 10).
- flood.B: if used, 8-12 sentences (or null).
- production: 5-6 items.

Variety & diversity (strict):
- Avoid repetition of the same core noun or verb across items. Use 
different everyday nouns (people, places, objects) and a range of 
high-frequency verbs.
- Ensure at least 6 distinct verbs and 8 distinct nouns across 
flood.A (and do not reuse the same noun/verb lemma more than once 
within flood.A).
- If flood.B is used, it must also have varied nouns and verbs; do 
not mirror flood.A with the same lexical items.

Output JSON must match this schema:

{
  "language": string;
  "diagnosis": {
    "target_label": string;
    "contrast_label": string | null;
    "why_error": string;
    "rules": string[];
  };
  "flood": {
    "A": [{ "text": string; "en": string }];
    "B": [{ "text": string; "en": string }] | null;
  };
  "paragraph": string;
  "production": [{ "prompt_en": string; "answer": string }];
  "takeaways": string[];
  "fix": { "original": string; "corrected": string };
}`;
}

// Intentionally no regex-based give-up detector; behavior is enforced via the meta-prompt.

export const inputFloodGrade = procedure
  .input(GradeRequestSchema)
  .output(GradeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("Unauthorized");

    // Guardrails (mirror API behavior)
    const languageName =
      supportedLanguages[
        input.language as keyof typeof supportedLanguages
      ] || input.language;
    const items = input.items.slice(0, 6).map((it) => ({
      prompt_en: it.prompt_en.slice(0, 200),
      answer: it.answer.slice(0, 200),
      attempt: it.attempt.slice(0, 200),
    }));

    const rubric = `You are grading short production attempts in ${languageName}.
Score each item on two criteria and output JSON only as { "grades": [{ "score": number, "feedback": string }, ...] } with the same order and length as the input.

Scoring (single numeric score 0-1):
- 1 = Semantically correct AND uses the target form appropriately.
- 0.5 = Meaning is acceptable but form is off, or vice versa.
- 0 = Incorrect meaning, ungrammatical, or wrong form.

Feedback: one short sentence in English, actionable and specific.
Do not include the correct answer verbatim unless trivial.
Remember that the student can't see the "answer" field and there are countless ways to say the same thing.
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
