import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai } from "./openai";
import { prismaClient } from "./prisma-client";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { getLangName } from "./get-lang-name";

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

const zodGradeResponse = z.object({
  yesNo: z.enum(["yes", "no"]),
  why: z.string(),
});

const storeTrainingData: StoreTrainingData = async (props, exp) => {
  const { term, definition, langCode, userInput } = props;
  const { yesNo, why } = exp;

  await prismaClient.trainingData.create({
    data: {
      term,
      definition,
      langCode,
      userInput,
      yesNo,
      explanation: why,
      quizType: "speaking-v2-prompt",
      englishTranslation: "NA",
    },
  });
};

async function run(props: GrammarCorrectionProps): Promise<Explanation> {
  const response = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: [
          `I am learning ${getLangName(props.langCode)}.`,
          `Translate ${props.term} to English.`,
        ].join(" "),
      },
      { role: "assistant", content: props.definition },
      {
        role: "user",
        content: [
          `Let's call the first sentence "the target sentence" and call the second sentence "the provided sentence".`,
          `In one sentence, explain if I could use "${props.userInput}" in a situation similar to the original sentence.`,
          `Is it close enough?`,
          `Don't restate my sentence or the target sentence.`,
        ].join(" "),
      },
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

  return gradeResponse;
}

async function runAndStore(
  props: GrammarCorrectionProps,
): Promise<Explanation> {
  const result = await run(props);
  storeTrainingData(props, result);
  return result;
}

export const grammarCorrectionNext: QuizEvaluator = async ({
  userInput,
  card,
}) => {
  const chosen = await runAndStore({ ...card, userInput });
  console.log(JSON.stringify(chosen));
  if (chosen.yesNo === "yes") {
    return { result: "pass", userMessage: "" };
  } else {
    return {
      result: "fail",
      userMessage: chosen.why,
    };
  }
};
