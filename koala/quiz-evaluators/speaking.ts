import {
  Explanation,
  testEquivalence,
  translateToEnglish,
} from "@/koala/openai";
import { QuizEvaluator } from "./types";
import { strip } from "./evaluator-utils";

const doGrade = async (
  userInput: string,
  term: string,
  definition: string,
  langCode: string,
): Promise<Explanation> => {
  if (strip(userInput) === strip(term)) {
    console.log(`=== Exact match! (29)`);
    return { response: "yes" };
  }

  const englishTranslation = await translateToEnglish(userInput, langCode);
  const exactTranslation = strip(englishTranslation) === strip(definition);

  if (exactTranslation) {
    console.log(`=== Exact match! (37)`);
    return { response: "yes" };
  }

  const response = await testEquivalence(term, userInput);

  return {
    response: response,
    whyNot: englishTranslation,
  };
};

export const speaking: QuizEvaluator = async ({ userInput, card }) => {
  if (strip(userInput) === strip(card.term)) {
    console.log(`=== Exact match! (53)`);
    return {
      result: "pass",
      userMessage: "Exact match. Nice work!",
    };
  }

  const result = await doGrade(
    userInput,
    card.term,
    card.definition,
    card.langCode,
  );

  const userMessage = result.whyNot || "No response";

  if (result.response === "no") {
    return {
      result: "fail",
      userMessage,
    };
  }

  return {
    result: "pass",
    userMessage,
  };
};
