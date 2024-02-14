import { QuizEvaluator } from "./types";

export const listening: QuizEvaluator = async (_) => {
  return {
    result: "pass",
    userMessage: "You passed the listening quiz!",
  };
};
