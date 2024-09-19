import { Quiz, Card } from "@prisma/client";
import { QuizResult } from "../shared-types";

type QuizEvaluatorInput = {
  quiz: Quiz;
  card: Card;
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
