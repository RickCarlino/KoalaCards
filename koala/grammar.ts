import { z } from "zod";
import { generateStructuredOutput } from "./ai";
import { prismaClient } from "./prisma-client";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { getLangName } from "./get-lang-name";
import { LangCode } from "./shared-types";

type Explanation = z.infer<typeof zodGradeResponse>;

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
      quizType: "speaking-v2-prompt-4.1",
      englishTranslation: "NA",
    },
  });
};

const LANG_OVERRIDES: Partial<Record<LangCode, string>> = {
  ko: "For the sake of this discussion, let's say that formality levels don't need to be taken into consideration.",
};

async function run(props: GrammarCorrectionProps): Promise<Explanation> {
  const override = LANG_OVERRIDES[props.langCode as LangCode] || "";
  const messages = [
    {
      role: "user" as const,
      content: [
        `I am learning ${getLangName(props.langCode)}.`,
        `We know "${props.term}" means "${props.definition}" in English.`,
        `Let's say I am in a situation that warrants the sentence above.`,
        `Could I say "${props.userInput}" instead (note: I entered it via speech-to-text)?`,
        `Would that be OK?`,
        override,
        `Explain in one tweet or less.`,
      ].join(" "),
    },
  ];
  const gradeResponse = await generateStructuredOutput({
    model: "openai:reasoning",
    messages,
    temperature: 0.1,
    maxTokens: 250,
    schema: zodGradeResponse,
  });

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
    return { result: "pass", userMessage: chosen.why };
  } else {
    return {
      result: "fail",
      userMessage: chosen.why,
    };
  }
};
