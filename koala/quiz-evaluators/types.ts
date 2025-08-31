import { Card } from "@prisma/client";
import { QuizResult } from "../shared-types";

type QuizEvaluatorInput = {
  card: Pick<Card, "term" | "definition" | "langCode">;
  userInput: string;
  userID: string;
};

type QuizEvaluatorOutput = {
  result: QuizResult;
  userMessage: string;
  // Present when grammar evaluation stores a QuizResult
  quizResultId?: number;
};

export type QuizEvaluator = (
  input: QuizEvaluatorInput,
) => Promise<QuizEvaluatorOutput>;
