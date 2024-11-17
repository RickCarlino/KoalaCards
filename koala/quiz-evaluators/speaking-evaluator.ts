import { testEquivalence, translateToEnglish } from "@/koala/openai";
import { grammarCorrection } from "../grammar";
import { captureTrainingData } from "./capture-training-data";
import { compare } from "./evaluator-utils";
import { QuizEvaluator } from "./types";
import { grammarCorrectionNG } from "../grammar-ng";

const doGrade = async (
  userInput: string,
  term: string,
  definition: string,
  langCode: string,
): Promise<{ result: "pass" | "fail"; userMessage: string }> => {
  if (compare(userInput, term, 1)) {
    return { result: "pass", userMessage: "Exact match." };
  }

  const englishTranslation = await translateToEnglish(userInput, langCode);

  if (compare(englishTranslation, definition, 1)) {
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
      userMessage: `Your sentence's translation: ${englishTranslation}`,
    };
  }

  const corrections = await grammarCorrection({
    term,
    definition,
    langCode,
    userInput,
  });

  const legit = corrections && compare(corrections, userInput);
  if (legit) {
    return {
      result: "fail",
      userMessage: `✏️${corrections}`,
    };
  }

  return {
    result: "pass",
    userMessage: "Good job!",
  };
};

export const speaking: QuizEvaluator = async ({ userInput, card }) => {
  const { term, definition, langCode } = card;
  if (compare(userInput, term, 1)) {
    return { result: "pass", userMessage: "Exact match." };
  }

  const resp = await grammarCorrectionNG({
    definition,
    langCode,
    term,
    userInput,
  });

  const userMessage = resp.correctedSentence || "";

  switch (resp.grade) {
    case "correct":
      return { result: "pass", userMessage };
    case "incorrect":
      return { result: "fail", userMessage };
    case "grammar":
      return { result: "fail", userMessage: `✏️${userMessage}` };
    default:
      return {
        result: "fail",
        userMessage: "An error occurred. Please report this.",
      };
  }
  // Leave the old one around for now...
  return await doGrade(userInput, card.term, card.definition, card.langCode);
};
