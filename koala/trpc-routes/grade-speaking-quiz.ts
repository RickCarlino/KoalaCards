import type { Card } from "@prisma/client";
import { z } from "zod";
import { generateStructuredOutput } from "../ai";
import { getUserSettings } from "../auth-helpers";
import { getLangName } from "../get-lang-name";
import { prismaClient } from "../prisma-client";
import { compare } from "../quiz-evaluators/evaluator-utils";
import { LangCode, QuizResult } from "../shared-types";
import { procedure } from "../trpc-procedure";

const zodGradeResponse = z.object({
  yesNo: z.enum(["yes", "no"]),
  why: z.string(),
});

type Explanation = z.infer<typeof zodGradeResponse>;

type GrammarCorrectionProps = {
  term: string;
  definition: string;
  userInput: string;
  userId: string;
  eventType?: string;
};

type QuizEvaluatorInput = {
  card: Pick<Card, "term" | "definition">;
  userInput: string;
  userID: string;
};

type QuizEvaluatorOutput = {
  result: QuizResult;
  userMessage: string;
  quizResultId?: number;
};

type QuizEvaluator = (
  input: QuizEvaluatorInput,
) => Promise<QuizEvaluatorOutput>;

type StoreTrainingData = (
  props: GrammarCorrectionProps,
  exp: Explanation,
) => Promise<number>;

const storeTrainingData: StoreTrainingData = async (props, exp) => {
  const { term, definition, userInput, userId, eventType } = props;
  const { yesNo, why } = exp;
  const created = await prismaClient.quizResult.create({
    data: {
      userId,
      acceptableTerm: term,
      definition,
      userInput,
      isAcceptable: yesNo === "yes",
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
  const override = LANG_OVERRIDES.ko ?? "";
  const messages = [
    {
      role: "user" as const,
      content: [
        `I am learning ${getLangName("ko")}.`,
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
    model: "cheap",
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

const grammarCorrectionNext: QuizEvaluator = async ({
  userInput,
  card,
  userID,
}) => {
  const { term, definition } = card;
  const { explanation, quizResultId } = await runAndStore({
    term,
    definition,
    userInput,
    userId: userID,
    eventType: "speaking-judgement",
  });
  console.log(JSON.stringify(explanation));
  if (explanation.yesNo === "yes") {
    return { result: "pass", userMessage: explanation.why, quizResultId };
  }
  return {
    result: "fail",
    userMessage: explanation.why,
    quizResultId,
  };
};

const speaking: QuizEvaluator = async (input) => {
  const { userInput, card } = input;
  const { term } = card;
  if (compare(userInput, term, 1)) {
    return { result: "pass", userMessage: "Exact match." };
  }
  return grammarCorrectionNext(input);
};

export const gradeSpeakingQuiz = procedure
  .input(z.object({ userInput: z.string(), cardID: z.number() }))
  .output(
    z.object({
      isCorrect: z.boolean(),
      feedback: z.string(),
      quizResultId: z.number().nullable(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userID = (await getUserSettings(ctx.user?.id)).user.id;

    const card = await prismaClient.card.findUnique({
      where: { id: input.cardID },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    if (card.userId !== userID) {
      throw new Error("Not your card");
    }

    const result = await speaking({
      card,
      userID,
      userInput: input.userInput,
    });

    return {
      isCorrect: result.result === "pass",
      feedback: result.userMessage,
      quizResultId: result.quizResultId ?? null,
    };
  });
