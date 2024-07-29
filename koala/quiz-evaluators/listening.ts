import { QuizEvaluator } from "./types";
import { testEquivalence } from "@/koala/openai";
import { strip } from "./evaluator-utils";

export const listening: QuizEvaluator = async (ctx) => {
  const { userInput, card } = ctx;
  const { definition } = card;

  if (strip(userInput) === strip(definition)) {
    console.log(`=== Exact match! (23)`);
    return {
      result: "pass",
      userMessage: "Exact match. Nice work!",
    };
  }

  const trialData = await testEquivalence(definition, userInput);

  if (trialData === "no") {
    return {
      result: "fail",
      userMessage: "Deprecated in FT model", // listeningYN.whyNot || "No explanation provided.",
    };
  }

  return {
    result: "pass",
    userMessage: "You passed the listening quiz!",
  };
};
