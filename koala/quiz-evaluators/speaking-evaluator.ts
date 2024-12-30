import { compare } from "./evaluator-utils";
import { QuizEvaluator } from "./types";
import { equivalence } from "../equivalence";
import { grammarCorrection } from "../grammar";

// ORDER MATTERS!:
const CHECKS = [equivalence, grammarCorrection] as const;
const PASS = { result: "pass", userMessage: "" } as const;

export const speaking: QuizEvaluator = async (input) => {
  const { userInput, card } = input;
  const { term } = card;
  if (compare(userInput, term, 1)) {
    return { result: "pass", userMessage: "Exact match." };
  }
  const promises = CHECKS.map((g) => g(input));
  // Run grammar and equivalence checks in parallel.
  const results = await Promise.all(promises);
  return results.find((r) => r.result === "fail") || PASS;
};
