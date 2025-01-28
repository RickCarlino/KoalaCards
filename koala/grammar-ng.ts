import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "./prisma-client";
import { openai } from "./openai";
import { compare } from "./quiz-evaluators/evaluator-utils";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { getLangName } from "./get-lang-name";

const zodGradeResponse = z.object({
  grade: z.enum(["ok", "edit", "fail"]),
  correctedSentence: z.string().optional(),
});

export type Explanation = z.infer<typeof zodGradeResponse>;

type GrammarCorrectionProps = {
  term: string; // Prompt term
  definition: string; // Example correct answer
  langCode: string;
  userInput: string;
};

type StoreTrainingData = (
  props: GrammarCorrectionProps,
  exp: Explanation,
) => Promise<void>;

const storeTrainingData: StoreTrainingData = async (props, exp) => {
  const { term, definition, langCode, userInput } = props;
  const { grade, correctedSentence } = exp;

  // Map "ok" to "correct", otherwise "incorrect"
  const yesNo = grade === "ok" ? "yes" : "no";

  await prismaClient.trainingData.create({
    data: {
      term,
      definition,
      langCode,
      userInput,
      yesNo,
      explanation: correctedSentence || "",
      quizType: "speaking",
      englishTranslation: "NA",
    },
  });
};

const JSON_PROMPT = [
  "Output exactly one JSON object, matching this schema:",
  "```json",
  "{",
  '  "grade": "ok" | "edit" | "fail",',
  '  "correctedSentence": "..." (optional if grade is "ok" or "fail")',
  "}",
  "```",
  "",
].join("\n");

function systemPrompt() {
  return [
    "=== EXAMPLES ===",
    "",
    "Example 1:",
    "- English prompt: “It's me who is truly sorry.”",
    "- User’s Attempt: “제가 말로 미안해요.”",
    "- Corrected Output: “저야말로 미안해요.” (EDIT)",
    "",
    "Example 2:",
    "- English prompt: “The economy will likely improve next year.”",
    "- User’s Attempt: “내년에 경제가 개선할 거예요.”",
    "- Corrected Output: “내년에 경제가 개선될 거예요.” (EDIT)",
    "",
    "Example 3:",
    "- English prompt: “If the user says something unrelated.”",
    "- User’s Attempt: “랄라 무슨 노래 먹고 있어요?”",
    "- Corrected Output: “NOT RELATED” (FAIL)",
    "",
    "Example 4:",
    "- English prompt: “I’m hungry now, so I can eat anything.”",
    "- User’s Attempt: “이제 배고파서 아무거나 먹을 수 있어요.”",
    "- Corrected Output: “이제 배고파서 아무거나 먹을 수 있어요.” (OK)",
    "",
    "=== INSTRUCTIONS ===",
    "You are a grammar and usage corrector for a multi-lingual language-learning app. Follow these rules carefully:",
    "1. MINIMAL EDITS",
    "   - Only fix true grammar errors or unnatural wording.",
    "   - Do NOT add extra words or forms if the sentence is already correct and idiomatic.",
    "   - Do NOT force the user’s attempt to match a provided reference if the user’s version is correct.",
    "",
    "2. POLITENESS & REGISTER",
    "   - If the user uses informal style, maintain it.",
    "   - If the user uses formal style, maintain it.",
    "   - If they mix styles incorrectly, correct to a consistent style.",
    "",
    "3. DIALECT OR REGIONAL USAGE",
    "   - If the user employs a regional/dialect form correctly, leave it as is.",
    "   - If a dialect form is used incorrectly, correct it to a clear variant or standard usage.",
    "",
    "4. “TOTALLY WRONG” CASE",
    '   - If the input is nonsensical or has no meaningful relation to the target phrase, output grade="fail" with no correctedSentence.',
    "   - This is only for extreme cases. Don’t nitpick minor differences.",
    "",
    "5. NO EXPLANATIONS",
    '   - Provide ONLY the final evaluation in JSON: { "grade": "ok|edit|fail", "correctedSentence": "..." }.',
    '   - If grade is "ok" or "fail", you may omit correctedSentence entirely.',
    "",
    "6. EQUIVALENT MEANING",
    "   - Do not get overly concerned about matching every detail of the English prompt in the user's output.",
    "   - Focus on correcting usage of the target language. Close enough in meaning is good enough.",
    "",
    JSON_PROMPT,
  ].join("\n");
}

function systemPrompt2() {
  return [
    "=== CONTEXT AWARE CORRECTIONS ===",
    "=== FOCUS: MINIMAL CHANGES ===",
    "Consider typical learner errors for the target language:",
    "- Korean: Particle errors (은/는 vs 이/가), incorrect use of verb endings",
    "- Japanese: Particle (は vs が), verb conjugations",
    "- Spanish: Gender agreement, ser/estar",
    "Only correct language learner errors. Ignore stylistic differences.",
    "If the error matches common learner mistakes for the language → EDIT",
    "Otherwise → OK",
    "Only correct clear grammatical errors. Preserve user's original wording when possible.",
    "Accept regional variations and synonyms unless they change meaning significantly.",
    "Example:",
    "- Prompt: 'I ate breakfast'",
    "- User: 'I eated breakfast' → 'I ate breakfast' (EDIT)",
    "- User: 'I had my morning meal' → OK (different phrasing)",
    JSON_PROMPT,
  ].join("\n");
}

const stats = {
  prompt1: { total: 0, ok: 0 },
  prompt2: { total: 0, ok: 0 },
};

function logStats() {
  const p1pct =
    stats.prompt1.total === 0
      ? 0
      : (100 * stats.prompt1.ok) / stats.prompt1.total;
  const p2pct =
    stats.prompt2.total === 0
      ? 0
      : (100 * stats.prompt2.ok) / stats.prompt2.total;

  console.log(
    `=== system prompt 1: ${p1pct.toFixed(
      2,
    )}%  |  system prompt 2: ${p2pct.toFixed(2)}%`,
  );
}

async function runSinglePrompt(
  promptNumber: 1 | 2,
  props: GrammarCorrectionProps,
): Promise<Explanation> {
  if (promptNumber === 1) {
    stats.prompt1.total++;
  } else {
    stats.prompt2.total++;
  }

  const selectedSystemPrompt =
    promptNumber === 1 ? systemPrompt() : systemPrompt2();

  const messages = [
    {
      role: "user" as const,
      content: selectedSystemPrompt,
    },
    {
      role: "user" as const,
      content: [
        `=== TASK ===`,
        `Correct the following user input (${getLangName(props.langCode)}):`,
        `English Prompt: "${props.definition}"`,
        `User's Attempt: "${props.userInput}"`,
      ].join("\n"),
    },
  ];

  const response = await openai.beta.chat.completions.parse({
    messages,
    model: "gpt-4o",
    max_tokens: 125,
    temperature: 0.1,
    response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
  });

  const gradeResponse = response.choices[0]?.message?.parsed;
  if (!gradeResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  if (
    gradeResponse.correctedSentence &&
    compare(props.userInput, gradeResponse.correctedSentence, 0)
  ) {
    gradeResponse.grade = "ok";
    delete gradeResponse.correctedSentence; // no need to keep the same text
  }

  // If it's "ok", increment that prompt's ok count
  if (gradeResponse.grade === "ok") {
    if (promptNumber === 1) {
      stats.prompt1.ok++;
    } else {
      stats.prompt2.ok++;
    }
  }

  return gradeResponse;
}

async function runChecks(props: GrammarCorrectionProps): Promise<Explanation> {
  const p1 = runSinglePrompt(1, props);
  const p2 = runSinglePrompt(2, props);
  const results = await Promise.all([p1, p2]);
  const ok = results.filter((x) => x.grade === "ok");
  const edit = results
    .filter((x) => x.grade === "edit")
    .sort((a, b) => {
      // Sort shortests response first:
      const aLen = a.correctedSentence?.length || 0;
      const bLen = b.correctedSentence?.length || 0;
      return aLen - bLen;
    });
  const fail = results.filter((x) => x.grade === "fail");

  logStats();

  results.map((r) => storeTrainingData(props, r));
  return ok[0] || edit[0] || fail[0];
}

export const grammarCorrectionNG: QuizEvaluator = async ({
  userInput,
  card,
}) => {
  const { term, definition, langCode } = card;

  const chosen = await runChecks({ term, definition, langCode, userInput });

  switch (chosen.grade) {
    case "ok":
      return { result: "pass", userMessage: "" };
    case "edit":
      return { result: "fail", userMessage: `✏️${chosen.correctedSentence}` };
    case "fail":
      return {
        result: "fail",
        userMessage: "(Failed) " + (chosen.correctedSentence || ""),
      };
  }
};
