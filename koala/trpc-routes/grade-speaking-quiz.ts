import { z } from "zod";
import { generateStructuredOutput } from "../ai";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { compare } from "../quiz-evaluators/evaluator-utils";
import { QuizResult } from "../shared-types";
import { procedure } from "../trpc-procedure";

const gradeResponseSchema = z.object({
  yesNo: z.enum(["yes", "no"]),
  why: z.string(),
});

const DEFAULT_EVENT_TYPE = "speaking-judgement";

type GradeResponse = z.infer<typeof gradeResponseSchema>;

type GrammarEvaluationInput = {
  term: string;
  definition: string;
  userInput: string;
  userId: string;
  deckName: string | null;
  deckDescription: string | null;
};

type GrammarMessage = {
  role: "user";
  content: string;
};

type SpeakingCard = {
  term: string;
  definition: string;
  deckName: string | null;
  deckDescription: string | null;
};

type SpeakingEvaluationInput = {
  card: SpeakingCard;
  userInput: string;
  userID: string;
};

type SpeakingEvaluationOutput = {
  result: QuizResult;
  userMessage: string;
  quizResultId?: number;
};

type SpeakingEvaluator = (
  input: SpeakingEvaluationInput,
) => Promise<SpeakingEvaluationOutput>;

const buildDeckContext = (
  deckName: string | null,
  deckDescription: string | null,
) => {
  const parts: string[] = [];
  if (deckName) {
    parts.push(`Deck: "${deckName}".`);
  }
  if (deckDescription) {
    parts.push(`Deck guidance: ${deckDescription}.`);
  }
  return parts.join(" ");
};

const buildGrammarPrompt = (input: GrammarEvaluationInput): string => {
  const deckContext = buildDeckContext(
    input.deckName,
    input.deckDescription,
  );
  return [
    "I am learning Korean. This is a flashcard app.",
    "Grade my response, which was entered via speech to text.",
    deckContext,
    `Prompt: ${input.definition}`,
    `Possible answer: "${input.term}".`,
    `My answer: "${input.userInput}".`,
    "Return yes/no with a brief reason. Avoid alternatives unless deck guidance asks.",
    "Answers must be very concise. Double check your response, and do not nitpick.",
  ]
    .filter(Boolean)
    .join(" ");
};

const buildGrammarMessages = (
  input: GrammarEvaluationInput,
): GrammarMessage[] => [
  { role: "user", content: buildGrammarPrompt(input) },
];

const requestGrammarEvaluation = async (
  input: GrammarEvaluationInput,
): Promise<GradeResponse> =>
  generateStructuredOutput({
    model: "cheap",
    messages: buildGrammarMessages(input),
    schema: gradeResponseSchema,
  });

const saveQuizResult = async (
  input: GrammarEvaluationInput,
  evaluation: GradeResponse,
): Promise<number> => {
  const isAcceptable = evaluation.yesNo === "yes";
  const created = await prismaClient.quizResult.create({
    data: {
      userId: input.userId,
      acceptableTerm: input.term,
      definition: input.definition,
      userInput: input.userInput,
      isAcceptable,
      reason: evaluation.why,
      eventType: DEFAULT_EVENT_TYPE,
    },
  });

  return created.id;
};

const toSpeakingEvaluationOutput = (
  evaluation: GradeResponse,
  quizResultId: number,
): SpeakingEvaluationOutput => {
  if (evaluation.yesNo === "yes") {
    return { result: "pass", userMessage: evaluation.why, quizResultId };
  }
  return { result: "fail", userMessage: evaluation.why, quizResultId };
};

const evaluateGrammarAttempt: SpeakingEvaluator = async ({
  userInput,
  card,
  userID,
}) => {
  const grammarInput: GrammarEvaluationInput = {
    term: card.term,
    definition: card.definition,
    userInput,
    userId: userID,
    deckName: card.deckName,
    deckDescription: card.deckDescription,
  };
  const evaluation = await requestGrammarEvaluation(grammarInput);
  const quizResultId = await saveQuizResult(grammarInput, evaluation);
  console.log(JSON.stringify(evaluation));
  return toSpeakingEvaluationOutput(evaluation, quizResultId);
};

const evaluateSpeakingAttempt: SpeakingEvaluator = async (input) => {
  const isExactMatch = compare(input.userInput, input.card.term, 1);
  if (isExactMatch) {
    return { result: "pass", userMessage: "Exact match." };
  }
  return evaluateGrammarAttempt(input);
};

async function getUserIdFromContext(
  ctxUserId: string | undefined,
): Promise<string> {
  const settings = await getUserSettings(ctxUserId);
  return settings.user.id;
}

async function getOwnedCardForSpeaking(
  cardID: number,
  userID: string,
): Promise<SpeakingCard> {
  const card = await prismaClient.card.findUnique({
    where: { id: cardID },
    select: {
      term: true,
      definition: true,
      userId: true,
      Deck: { select: { name: true, description: true } },
    },
  });

  if (!card) {
    throw new Error("Card not found");
  }

  if (card.userId !== userID) {
    throw new Error("Not your card");
  }

  return {
    term: card.term,
    definition: card.definition,
    deckName: card.Deck?.name ?? null,
    deckDescription: card.Deck?.description ?? null,
  };
}

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
    const userID = await getUserIdFromContext(ctx.user?.id);
    const card = await getOwnedCardForSpeaking(input.cardID, userID);
    const result = await evaluateSpeakingAttempt({
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
