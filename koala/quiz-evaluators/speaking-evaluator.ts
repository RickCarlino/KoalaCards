import {
  Explanation,
  testEquivalence,
  translateToEnglish,
} from "@/koala/openai";
import { grammarCorrection } from "../grammar";
import { captureTrainingData } from "./capture-training-data";
import { compare } from "./evaluator-utils";
import { QuizEvaluator } from "./types";

const PERFECT = "Perfect match!";

const doGrade = async (
  userInput: string,
  term: string,
  definition: string,
  langCode: string,
): Promise<Explanation> => {
  if (compare(userInput, term)) {
    return { response: "yes", whyNot: PERFECT };
  }

  const englishTranslation = await translateToEnglish(userInput, langCode);
  const exactTranslation = compare(englishTranslation, definition);

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

  if (response === "yes") {
    const x = await grammarCorrection({
      term,
      definition,
      langCode,
      userInput,
    });

    if (x) {
      // Equivalent with grammar correction.
      return {
        response: "no",
        whyNot: `${x} (suggested correction)`,
      };
    }
  }

  return {
    response: response,
    whyNot: `Input means "${englishTranslation}". ` + 46,
  };
};

export const speaking: QuizEvaluator = async ({ userInput, card }) => {
  if (compare(userInput, card.term)) {
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

  // Equivalent with no grammar correction.
  return {
    result: "pass",
    userMessage: "Good job! " + 91,
  };
};
