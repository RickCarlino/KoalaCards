import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "./prisma-client";
import { getLangName } from "./get-lang-name";

// Ensure the OpenAI API key is available
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
  throw new Error("Missing OPENAI_API_KEY");
}

// Initialize OpenAI client
const openai = new OpenAI({ apiKey });

// Generic GPT call function
export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return openai.chat.completions.create(opts);
}

// Define the expected structure of the grade response
const zodGradeResponse = z.object({
  grade: z.enum(["correct", "grammar", "incorrect"]),
  correctedSentence: z.string().optional(),
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

// Store training data in the database
async function storeTrainingData(
  props: GrammarCorrectionProps,
  exp: Explanation,
) {
  const { term, definition, langCode, userInput } = props;
  const { grade, correctedSentence } = exp;
  await prismaClient.trainingData.create({
    data: {
      term,
      definition,
      langCode,
      userInput,
      yesNo: grade === "correct" ? "yes" : "no",
      explanation: correctedSentence || "",
      quizType: "speaking",
      englishTranslation: "NA",
    },
  });
}

// Build the prompt for OpenAI
const buildPrompt = (props: GrammarCorrectionProps, lang: string): string =>
  [
    "You are a language learning assistant.",
    `You asked the user to say "${props.definition}" in ${lang}.`,
    `They responded with: "${props.userInput}".`,
    "Evaluate the user's response according to the following criteria:",
    "1. Correct: The sentence is correct (or close enough) both in its grammar usage and target meaning.",
    "2. Grammar: The student said a correct sentence, but it has minor grammar issues. In this case, provide a mild correction in the 'correctedSentence' field.",
    "3. Incorrect: The meaning of the sentence is not the same, or there are major grammar problems. Write a SHORT explanation of the problem.",
    "Your response should be a JSON object with the following structure:",
    'For Correct: { "grade": "correct" }',
    'For Grammar: { "grade": "grammar", "correctedSentence": "..." }',
    'For Incorrect: { "grade": "incorrect" }',
    "Do not include any explanations or additional text.",
  ].join("\n");

// Main function for grammar correction
export const grammarCorrectionNG = async (
  props: GrammarCorrectionProps,
): Promise<Explanation> => {
  const model = "gpt-4o-2024-08-06";
  const lang = getLangName(props.langCode);
  const prompt = buildPrompt(props, lang);

  try {
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

    await storeTrainingData(props, gradeResponse);
    return gradeResponse;
  } catch (error) {
    errorReport(`GrammarCorrectionNG Error: ${(error as Error).message}`);
    return {
      grade: "incorrect",
      correctedSentence: "This should never happen. Submit a bug report.",
    };
  }
};
