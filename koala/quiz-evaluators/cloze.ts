import { renderSolution } from "@/pages/cloze-parsers";
import { strip } from "./evaluator-utils";
import { QuizEvaluator } from "./types";

export const cloze: QuizEvaluator = async (params) => {
  const { userInput, card } = params;

  if (strip(userInput) === strip(renderSolution(card.term))) {
    console.log(`=== Exact match! (9)`);
    return {
      result: "pass",
      userMessage: "Exact match. Nice work!",
    };
  }
  return {
    result: "fail",
    userMessage: strip(userInput),
  };
};
