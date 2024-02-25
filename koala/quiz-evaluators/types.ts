import { Quiz, Card } from "@prisma/client";

export type QuizEvaluatorInput = {
  quiz: Quiz;
  card: Card;
  userInput: string;
  userID: string;
};

export type QuizEvaluatorOutput = {
  result: "pass" | "fail" | "error";
  userMessage: string;
};

export type QuizEvaluator = (
  input: QuizEvaluatorInput,
) => Promise<QuizEvaluatorOutput>;
