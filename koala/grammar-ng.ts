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
    "   - This is only reserved for extreme cases. Dont nitpick or search for minor errors.",
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
    "You are a **language usage and grammar corrector** for a flashcard app. When given:",
    "1. An **English prompt** (the meaning the user should convey).",
    "2. The **user’s attempted response** in the target language.",
    "",
    "Your goals:",
    "1. **Evaluate correctness and naturalness** with the fewest edits possible.",
    "2. **Allow synonyms** or alternate phrasing that preserves the same meaning.",
    "3. **Preserve** the user’s politeness level or dialect if coherent.",
    "4. **Ignore minor style differences**. Only fix real usage or grammar mistakes.",
    "",
    "Return exactly one JSON object in this format:",
    "```json",
    "{",
    '  "grade": "ok" | "edit" | "fail",',
    '  "correctedSentence": "..." (if grade="edit")',
    "}",
    "```",
    "",
    "- **ok** if no changes are needed and it’s natural enough.",
    '- **edit** if you must fix a mistake. Provide a minimal corrected sentence in "correctedSentence".',
    "- **fail** if the user’s response is off-topic or nonsensical; do NOT provide a corrected sentence.",
    "",
    JSON_PROMPT,
  ].join("\n");
}

const stats = {
  prompt1: { total: 0, ok: 0 },
  prompt2: { total: 0, ok: 0 },
};

function createMessages(
  langCode: string,
  definition: string,
  userInput: string,
) {
  const isPrompt2 = Math.random() < 0.5;

  if (isPrompt2) {
    stats.prompt2.total++;
  } else {
    stats.prompt1.total++;
  }

  const selectedSystemPrompt = isPrompt2 ? systemPrompt2() : systemPrompt();

  return {
    isPrompt2,
    messages: [
      {
        role: "user" as const,
        content: selectedSystemPrompt,
      },
      {
        role: "user" as const,
        content: [
          `=== TASK ===`,
          `Correct the following user input (${getLangName(langCode)}):`,
          `English Prompt: "${definition}"`,
          `User's Attempt: "${userInput}"`,
        ].join("\n"),
      },
    ],
  };
}

async function runChecks(props: GrammarCorrectionProps): Promise<Explanation> {
  const { userInput, langCode } = props;

  const { isPrompt2, messages } = createMessages(
    langCode,
    props.definition,
    userInput,
  );

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

  if (compare(userInput, gradeResponse.correctedSentence || "", 0)) {
    gradeResponse.grade = "ok";
  }

  if (gradeResponse.grade === "ok") {
    if (isPrompt2) {
      stats.prompt2.ok++;
    } else {
      stats.prompt1.ok++;
    }
  }

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

  // Store the final data
  await storeTrainingData(props, gradeResponse);
  return gradeResponse;
}

export const grammarCorrectionNG: QuizEvaluator = async ({
  userInput,
  card,
}) => {
  const check = async (): ReturnType<QuizEvaluator> => {
    const resp = await runChecks({
      term: card.term,
      definition: card.definition,
      langCode: card.langCode,
      userInput,
    });

    switch (resp.grade) {
      case "ok":
        return { result: "pass", userMessage: "" };
      case "edit":
        return { result: "fail", userMessage: `✏️${resp.correctedSentence}` };
      case "fail":
        return {
          result: "fail",
          userMessage: "(Failed) " + (resp.correctedSentence || ""),
        };
    }
  };

  return check();
};
