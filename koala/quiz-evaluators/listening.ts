import { QuizEvaluator } from "./types";
import { testEquivalence } from "@/koala/openai";
import { strip } from "./evaluator-utils";
import { captureTrainingData } from "./capture-training-data";

export const listening: QuizEvaluator = async (ctx) => {
  const { userInput, card } = ctx;
  const { definition, term, langCode } = card;

  if (strip(userInput) === strip(definition)) {
    console.log(`=== Exact match! (23)`);
    return {
      result: "pass",
      userMessage: "Exact match. Nice work!",
    };
  }

  console.log(`=== LISTENING EVALUATOR ===`);
  const response = await testEquivalence(definition, userInput);

  captureTrainingData({
    quizType: "listening",
    yesNo: response,
    explanation: process.env.GPT_MODEL || "gpt-4o",
    term,
    definition,
    langCode,
    userInput,
    englishTranslation: "",
  });

  if (response === "no") {
    return {
      result: "fail",
      userMessage: "",
    };
  }

  return {
    result: "pass",
    userMessage: "You passed the listening quiz!",
  };
};
