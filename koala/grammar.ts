import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "./prisma-client";
import { getLangName } from "./get-lang-name";
import { openai } from "./openai";
import {
  compare,
  stripFinalPunctuation,
} from "./quiz-evaluators/evaluator-utils";
import { QuizEvaluator } from "./quiz-evaluators/types";

export type Explanation = z.infer<typeof zodGradeResponse>;

type GrammarCorrectionProps = {
  term: string;
  definition: string;
  langCode: string;
  userInput: string;
};

type StoreTrainingData = (
  props: GrammarCorrectionProps,
  exp: Explanation,
) => Promise<void>;

const zodGradeResponse = z.object({
  grade: z.enum(["correct", "incorrect"]),
  correctedSentence: z.string().optional(),
});

const storeTrainingData: StoreTrainingData = async (props, exp) => {
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
};

function buildPrompt({ userInput }: GrammarCorrectionProps, lang: string) {
  return [
    `### INPUT: "${userInput}".`,
    `You are a spelling and grammar checker (language: ${lang}).`,
    "Your job is strictly to correct spelling and grammar.",
    "Do not to change word choice or style.",
    "You will be penalized for adding explanations, style suggestions or nitpicking grammar fixes that are not strictly required.",
    "Respond with JSON:",
    '{ "grade": "correct" } or { "grade": "incorrect", "correctedSentence": "..." }',
  ].join("\n");
}

async function checkGrammar(
  props: GrammarCorrectionProps,
): Promise<Explanation> {
  const { userInput, langCode } = props;

  const check = async () => {
    const response = await openai.beta.chat.completions.parse({
      messages: [
        { role: "user", content: buildPrompt(props, getLangName(langCode)) },
      ],
      model: "gpt-4o",
      max_tokens: 125,
      temperature: 0.1,
      response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
    });
    const gradeResponse = response.choices[0]?.message?.parsed;

    if (!gradeResponse) {
      throw new Error("Invalid response format from OpenAI.");
    }
    const l = stripFinalPunctuation(userInput).toLocaleLowerCase();
    const r = stripFinalPunctuation(
      gradeResponse.correctedSentence || "",
    ).toLocaleLowerCase();

    if (compare(l, r, 0)) {
      gradeResponse.grade = "correct";
    }
    await storeTrainingData(props, gradeResponse);
    return gradeResponse;
  };

  const results = await Promise.all([check(), check()]);
  return results.find((response) => response.grade === "correct") || results[0];
}

export const grammarCorrection: QuizEvaluator = async ({ userInput, card }) => {
  const resp = await checkGrammar({
    term: card.term,
    definition: card.definition,
    langCode: card.langCode,
    userInput,
  });
  return resp.grade === "correct"
    ? { result: "pass", userMessage: "" }
    : { result: "fail", userMessage: `✏️${resp.correctedSentence || ""}` };
};
