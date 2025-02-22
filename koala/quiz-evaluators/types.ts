import { Card } from "@prisma/client";
import { QuizResult } from "../shared-types";

type QuizEvaluatorInput = {
  card: Card
  userInput: string;
  userID: string;
};

export type QuizEvaluatorOutput = {
  result: QuizResult;
  userMessage: string;
};

export type QuizEvaluator = (
  input: QuizEvaluatorInput,
) => Promise<QuizEvaluatorOutput>;
