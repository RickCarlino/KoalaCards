import { compare } from "./evaluator-utils";
import { QuizEvaluator } from "./types";
import { grammarCorrectionNext } from "../grammar";

export const speaking: QuizEvaluator = async (input) => {
  const { userInput, card } = input;
  const { term } = card;
  if (compare(userInput, term, 1)) {
    return { result: "pass", userMessage: "Exact match." };
  }
  return await grammarCorrectionNext(input);
};
