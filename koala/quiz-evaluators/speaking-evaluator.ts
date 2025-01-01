import { compare } from "./evaluator-utils";
import { QuizEvaluator } from "./types";
import { equivalence } from "../equivalence";
import { grammarCorrectionNG } from "../grammar-ng";

// ORDER MATTERS!:
const CHECKS = [equivalence, grammarCorrectionNG] as const;
const PASS = { result: "pass", userMessage: "" } as const;

export const speaking: QuizEvaluator = async (input) => {
  const { userInput, card } = input;
  const { term } = card;
  if (compare(userInput, term, 1)) {
    return { result: "pass", userMessage: "Exact match." };
  }
  const promises = CHECKS.map((g) => g(input));
  // Run grammar and equivalence checks in sequence:
  for (const promise of promises) {
    const result = await promise;
    if (result.result === "fail") {
      return result;
    }
  }
  return PASS;
};
