import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "./openai";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { translate } from "./translate";
import { compare } from "./quiz-evaluators/evaluator-utils";

export type Explanation = z.infer<typeof zodGradeResponse>;

type GrammarCorrectionProps = {
  term: string;
  definition: string;
  langCode: string;
  userInput: string;
};

const zodGradeResponse = z.object({
  evaluation: z.enum(["yes", "no"]),
});

const PASS = {
  result: "pass",
  userMessage: "OK",
} as const;

const buildPrompt = (props: GrammarCorrectionProps): string =>
  [
    `### SENTENCE A: "${props.userInput}".`,
    `### SENTENCE B: "${props.term}".`,
    "(YES/NO) Does Sentence A more-or-less mean the same thing as Sentence B?",
    "Meanings do not need to be 100% exact, just mostly the same.",
  ].join("\n");

// Main function for grammar correction
export const equivalence: QuizEvaluator = async (input) => {
  const model = "gpt-4o";
  const { term, definition, langCode } = input.card;
  const { userInput } = input;
  const prompt = buildPrompt({ term, definition, langCode, userInput });

  const check = async () => {
    const response = await openai.beta.chat.completions.parse({
      messages: [{ role: "user", content: prompt }],
      model,
      max_tokens: 125,
      temperature: 0.1,
      response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
      store: true,
    });
    return response.choices[0]?.message?.parsed;
  };

  const gradeResponse = await check();

  if (gradeResponse?.evaluation === "yes") {
    return PASS;
  } else {
    // Check again:
    const secondResponse = await check();
    if (secondResponse?.evaluation === "yes") {
      return PASS;
    }
    return await handleFailure(langCode, userInput, definition);
  }
};

async function handleFailure(
  langCode: string,
  userInput: string,
  definition: string,
): Promise<{ result: "fail" | "pass"; userMessage: string }> {
  const englishTranslation = await translate(langCode, userInput);
  if (compare(englishTranslation, definition)) {
    return PASS;
  }
  return {
    result: "fail",
    userMessage: `Incorrect response. Your sentence translates to '${englishTranslation}'.`,
  };
}
