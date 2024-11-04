import {
  Explanation,
  testEquivalence,
  translateToEnglish,
} from "@/koala/openai";
import { QuizEvaluator } from "./types";
import { strip } from "./evaluator-utils";
import { captureTrainingData } from "./capture-training-data";
import { grammarCorrection } from "../grammar";

const PERFECT = "Perfect match!";

const doGrade = async (
  userInput: string,
  term: string,
  definition: string,
  langCode: string,
): Promise<Explanation> => {
  if (strip(userInput) === strip(term)) {
    return { response: "yes", whyNot: PERFECT };
  }

  const englishTranslation = await translateToEnglish(userInput, langCode);
  const exactTranslation = strip(englishTranslation) === strip(definition);

  if (exactTranslation) {
    return { response: "yes", whyNot: "Exact translation. " + 25 };
  }

  const response = await testEquivalence(
    `${term} (${definition})`,
    `${userInput} (${englishTranslation})`,
  );

  captureTrainingData({
    quizType: "speaking",
    yesNo: response,
    explanation: process.env.GPT_MODEL || "gpt-4o",
    term,
    definition,
    langCode,
    userInput,
    englishTranslation,
  });

  return {
    response: response,
    whyNot: `"${userInput}" means "${englishTranslation}". ` + 46,
  };
};

export const speaking: QuizEvaluator = async ({ userInput, card }) => {
  if (strip(userInput) === strip(card.term)) {
    console.log(`=== Exact match! (53)`);
    return {
      result: "pass",
      userMessage: "Exact match. Nice work! " + 55,
    };
  }

  const result = await doGrade(
    userInput,
    card.term,
    card.definition,
    card.langCode,
  );

  if (result.whyNot === PERFECT) {
    return {
      result: "pass",
      userMessage: "Perfect match! " + 63,
    };
  }

  if (result.response === "no") {
    const userMessage = (result.whyNot || "No response") + 67;

    return {
      result: "fail",
      userMessage,
    };
  }

  const x = await grammarCorrection({
    term: card.term,
    definition: card.definition,
    langCode: card.langCode,
    userInput,
  });

  if (x) {
    // Equivalent with grammar correction.
    return {
      result: "fail",
      userMessage: `Instead of '${userInput}' say '${x}' ` + 85,
    };
  }

  // Equivalent with no grammar correction.
  return {
    result: "pass",
    userMessage: "Good job! " + 91,
  };
};
