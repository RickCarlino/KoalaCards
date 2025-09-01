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
  userId: string;
  eventType?: string;
};

type StoreTrainingData = (
  props: GrammarCorrectionProps,
  exp: Explanation,
) => Promise<number>;

const zodGradeResponse = z.object({
  yesNo: z.enum(["yes", "no"]),
  why: z.string(),
});

const storeTrainingData: StoreTrainingData = async (props, exp) => {
  const { term, definition, langCode, userInput, userId, eventType } =
    props;
  const { yesNo, why } = exp;

  const created = await prismaClient.quizResult.create({
    data: {
      userId,
      acceptableTerm: term,
      definition,
      langCode,
      userInput,
      isAcceptable: yesNo === "yes",
      // reason field mapped from the model; store under reason
      reason: why,
      eventType: eventType || "speaking-judgement",
    },
  });

  return created.id;
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
        `My prompt was: ${props.definition} (${props.term})`,
        `Let's say I am in a situation that warrants the sentence or prompt above.`,
        `Could one say "${props.userInput}"?`,
        `Would that be OK?`,
        `(entered via speech-to-text, I have no control over spacing or punctuation so please focus on the content.)`,
        override,
        `Explain in one tweet or less.`,
      ].join(" "),
    },
  ];
  const gradeResponse = await generateStructuredOutput({
    model: ["openai", "cheap"],
    messages,
    schema: zodGradeResponse,
  });

  return gradeResponse;
}

async function runAndStore(
  props: GrammarCorrectionProps,
): Promise<{ explanation: Explanation; quizResultId: number }> {
  const result = await run(props);
  const id = await storeTrainingData(props, result);
  return { explanation: result, quizResultId: id };
}

export const grammarCorrectionNext: QuizEvaluator = async ({
  userInput,
  card,
  userID,
}) => {
  const { explanation, quizResultId } = await runAndStore({
    ...card,
    userInput,
    userId: userID,
    eventType: "speaking-judgement",
  });
  console.log(JSON.stringify(explanation));
  if (explanation.yesNo === "yes") {
    return { result: "pass", userMessage: explanation.why, quizResultId };
  } else {
    return {
      result: "fail",
      userMessage: explanation.why,
      quizResultId,
    };
  }
};

export async function gradeUtterance(params: {
  term: string;
  definition: string;
  langCode: LangCode | string;
  userInput: string;
  userId: string;
  eventType?: string;
}): Promise<{
  isCorrect: boolean;
  feedback: string;
  quizResultId: number;
}> {
  const { explanation, quizResultId } = await runAndStore({
    term: params.term,
    definition: params.definition,
    langCode: String(params.langCode),
    userInput: params.userInput,
    userId: params.userId,
    eventType: params.eventType || "speaking-judgement",
  });
  return {
    isCorrect: explanation.yesNo === "yes",
    feedback: explanation.why,
    quizResultId,
  };
}
