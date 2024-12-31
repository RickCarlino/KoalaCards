import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "./openai";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { translate } from "./translate";

// Define the expected structure of the grade response
const zodGradeResponse = z.object({
  evaluation: z.enum(["yes", "no"]),
});

// Type definition for Explanation based on Zod schema
export type Explanation = z.infer<typeof zodGradeResponse>;

// Props required for grammar correction
type GrammarCorrectionProps = {
  term: string;
  definition: string;
  langCode: string;
  userInput: string;
};

// Build the prompt for OpenAI
const buildPrompt = (props: GrammarCorrectionProps): string =>
  [
    `### SENTENCE A: "${props.userInput}".`,
    `### SENTENCE B: "${props.term}".`,
    "(YES/NO) Does Sentence A more-or-less mean the same thing as Sentence B?",
    "Meanings do not need to be 100% exact, just mostly the same?",
  ].join("\n");

// Main function for grammar correction
export const equivalence: QuizEvaluator = async (input) => {
  const model = "gpt-4o-mini";
  const { term, definition, langCode } = input.card;
  const { userInput } = input;
  const prompt = buildPrompt({ term, definition, langCode, userInput });

  // compare student's answer with expected answer
  const response = await openai.beta.chat.completions.parse({
    messages: [{ role: "user", content: prompt }],
    model,
    max_tokens: 125,
    temperature: 0.1,
    response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
  });

  const gradeResponse = response.choices[0]?.message?.parsed;

  if (!gradeResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  if (gradeResponse.evaluation === "yes") {
    return {
      result: "pass",
      userMessage: "OK",
    };
  } else {
    const englishTranslation = await translate(langCode, userInput);
    return {
      result: "fail",
      userMessage: `Inccorrect response. Your sentence translates to '${englishTranslation}'.`,
    };
  }
};
