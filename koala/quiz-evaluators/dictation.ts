import { QuizEvaluator } from "./types";

export const dictation: QuizEvaluator = async (_) => {
  console.log("=== Dictation ===");
  return {
    result: "pass",
    userMessage: "Dictation tests are not graded.",
  };
};
