import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "./prisma-client";
import { openai } from "./openai";
import { compare, levenshtein } from "./quiz-evaluators/evaluator-utils";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { getLangName } from "./get-lang-name";

const zodGradeResponse = z.object({
  grade: z.enum(["ok", "edit"]),
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

// const JSON_PROMPT = [
//   "Output exactly one JSON object, matching this schema:",
//   "```json",
//   "{",
//   '  "grade": "ok" | "edit",',
//   '  "correctedSentence": "..." (only if grade is "edit")',
//   "}",
//   "```",
//   "",
// ].join("\n");

const CANDIDATE2 = `
You are a language evaluation engine. Your sole task is to judge a student’s translation solely on its grammatical accuracy in the target language. The student’s response is provided along with an original English sentence (the “Student Prompt”) to offer context, but you must ignore stylistic choices or vocabulary variations unless they cause a clear, unambiguous grammatical error.

Instructions:
• If the student’s translation is grammatically correct, output a JSON object with "grade" set to "ok" and no additional fields.
• If there is a grammatical error, output a JSON object with "grade" set to "edit" and include a "correctedSentence" field containing a minimally revised version of the student’s translation. Your correction must address only grammatical issues—not offer rephrasing, stylistic improvements, or tone changes.
• Only focus on grammar. Even if the translation differs in style or word choice from an expected answer, mark it as "ok" as long as the grammar is correct.
• Output exactly one JSON object matching this schema and nothing else:
 {
  "grade": "ok" | "edit",
  "correctedSentence": "..."     // Only present when grade is "edit"
 }

Do not include any commentary, markdown formatting, or extra text in your output.
`;

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
  return CANDIDATE2;
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

  const { total } = stats.prompt1;
  const p1 = p1pct.toFixed(2);
  const p2 = p2pct.toFixed(2);
  console.log(`=== T: ${total} p1: ${p1}% p2: ${p2}%`);
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
        `Language: ${getLangName(props.langCode)}`,
        `Student Prompt: "${props.definition}"`,
        `Student Response: "${props.userInput}"`,
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
    delete gradeResponse.correctedSentence;
  }

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
      const distA = levenshtein(props.userInput, a.correctedSentence || "");
      const distB = levenshtein(props.userInput, b.correctedSentence || "");
      return distA - distB;
    });

  logStats();

  results.map((r) => storeTrainingData(props, r));

  const ERROR = {
    grade: "edit",
    correctedSentence: "?? Grading error ??",
  };
  return ok[0] || edit[0] || ERROR;
}

export const grammarCorrectionNG: QuizEvaluator = async ({
  userInput,
  card,
}) => {
  const { term, definition, langCode } = card;
  const chosen = await runChecks({ term, definition, langCode, userInput });

  if (chosen.grade === "ok") {
    return { result: "pass", userMessage: "" };
  } else {
    // "edit"
    return {
      result: "fail",
      userMessage: `✏️${chosen.correctedSentence || ""}`,
    };
  }
};
