import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "./prisma-client";
import { openai } from "./openai";
import { compare } from "./quiz-evaluators/evaluator-utils";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { getLangName } from "./get-lang-name";

// We now allow three possible outcomes: "ok", "edit", or "fail",
// but we still map them internally to "correct" or "incorrect" to avoid breaking existing code.
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
// Build the new multi-lingual minimal-edit prompt:
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
    "- Corrected Output: “이제 배고파서 아무거나 먹을 수 있어요.”  (OK)",
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

function createMessages(
  langCode: string,
  definition: string,
  userInput: string,
) {
  const result = [
    { role: "user" as const, content: systemPrompt() },
    {
      role: "user" as const,
      content: [
        `=== TASK ===`,
        `Correct the following user input (${getLangName(langCode)}):`,
        `English Prompt: "${definition}"`,
        `User's Attempt: "${userInput}"`,
      ].join("\n"),
    },
  ];

  console.log(result);
  return result;
}

async function runChecks(props: GrammarCorrectionProps): Promise<Explanation> {
  const { userInput, langCode } = props;
  const messages = createMessages(langCode, props.definition, userInput);
  const response = await openai.beta.chat.completions.parse({
    messages,
    model: "gpt-4o",
    max_tokens: 125,
    temperature: 0.1,
    response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
  });

  // This is the LLM's structured response (or an error if parsing failed)
  const gradeResponse = response.choices[0]?.message?.parsed;
  if (!gradeResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  if (compare(userInput, gradeResponse.correctedSentence || "", 0)) {
    gradeResponse.grade = "ok";
  }

  // Store the final data (with "ok" = correct, others = incorrect)
  await storeTrainingData(props, gradeResponse);
  return gradeResponse;
}

async function runChecksO1(
  props: GrammarCorrectionProps,
): Promise<Explanation> {
  const { userInput, langCode } = props;
  const messages = createMessages(langCode, props.definition, userInput);
  const rawResponse = await openai.beta.chat.completions.parse({
    messages,
    model: "o1-mini",
  });

  const respText = rawResponse.choices[0]?.message?.content;

  if (!respText) {
    throw new Error("Invalid response format from OpenAI.");
  }

  const jsonResponse = await openai.beta.chat.completions.parse({
    messages: [
      { role: "user", content: respText },
      {
        role: "system",
        content: [
          "You are a JSON parser. Convert the input to JSON format.",
        ].join("\n"),
      },
    ],
    model: "gpt-4o-mini",
    max_tokens: 125,
    temperature: 0.1,
    response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
  });

  // This is the LLM's structured response (or an error if parsing failed)
  const gradeResponse = jsonResponse.choices[0]?.message?.parsed;
  if (!gradeResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  if (compare(userInput, gradeResponse.correctedSentence || "", 0)) {
    gradeResponse.grade = "ok";
  }

  // Store the final data (with "ok" = correct, others = incorrect)
  await storeTrainingData(props, gradeResponse);
  return gradeResponse;
}

export const grammarCorrectionNG: QuizEvaluator = async ({
  userInput,
  card,
}) => {
  // Not impressed with GPT-O1-Mini.
  const fn = Math.random() > 1 ? runChecksO1 : runChecks;
  const resp = await fn({
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
        userMessage: "(Failed) " + resp.correctedSentence || "",
      };
  }
};
