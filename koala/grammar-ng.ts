import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "./prisma-client";
import { openai } from "./openai";
import { compare, levenshtein } from "./quiz-evaluators/evaluator-utils";
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
    "=== GRAMMAR ERROR DETECTION ===",
    "=== FOCUS: LEARNER MISTAKES ONLY ===",
    "Your task: Identify and correct ONLY common language learner grammatical errors.",
    "DO NOT suggest improvements to:",
    "- Vocabulary choice/phrasing",
    "- Style/nuance",
    "- Regional variations",
    "- Naturalness of expression",
    "ONLY correct these specific error types:",
    "Korean: Particle errors (은/는 vs 이/가), incorrect verb endings",
    "Japanese: Particle errors (は vs が), verb conjugation mistakes",
    "Spanish: Gender agreement errors, ser/estar confusion",
    "Evaluation rules:",
    "1. If sentence is grammatically correct → RESPOND WITH 'OK'",
    "2. If contains learner mistake from listed categories → EDIT (minimal changes)",
    "3. If error not in listed categories → 'OK' even if non-ideal",
    "4. Preserve user's original words when possible",
    "Critical constraints:",
    "- NEVER add suggestions/comments",
    "- NEVER correct valid regional variations",
    "- NEVER edit stylistically different but grammatically correct sentences",
    "Examples:",
    "- User: 'Él está ingeniero' → 'Él es ingeniero' (ser/estar EDIT)",
    "- User: 'Watashi wa gakusei desu' → OK (correct particles)",
    "- User: 'She eat rice' → 'She eats rice' (verb conjugation EDIT)",
    "- User: 'I consumed breakfast' → OK (different phrasing but correct)",
    "Output ONLY 'OK' or edited sentence with minimal corrections.",
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
      const aLen = levenshtein(props.userInput, a.correctedSentence || '');
      const bLen = levenshtein(props.userInput, b.correctedSentence || '');
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
