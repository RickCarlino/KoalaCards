import {
  testEquivalence,
  translateToEnglish,
} from "@/koala/openai";
import { grammarCorrection } from "../grammar";
import { captureTrainingData } from "./capture-training-data";
import { compare } from "./evaluator-utils";
import { QuizEvaluator } from "./types";

const doGrade = async (
  userInput: string,
  term: string,
  definition: string,
  langCode: string,
): Promise<{ result: "pass" | "fail"; userMessage: string }> => {
  if (compare(userInput, term)) {
    return { result: "pass", userMessage: "Exact match." };
  }

  const englishTranslation = await translateToEnglish(userInput, langCode);

  if (compare(englishTranslation, definition)) {
    return { result: "pass", userMessage: "Exact translation." };
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

  if (response !== "yes") {
    return {
      result: "fail",
      userMessage: `Your answer would mean "${englishTranslation}".`,
    };
  }

  const corrections = await grammarCorrection({
    term,
    definition,
    langCode,
    userInput,
  });

  if (corrections) {
    return {
      result: "fail",
      userMessage: corrections,
    };
  }

  return {
    result: "pass",
    userMessage: "Good job!",
  };
};

export const speaking: QuizEvaluator = async ({ userInput, card }) => {
  return await doGrade(userInput, card.term, card.definition, card.langCode);
};
