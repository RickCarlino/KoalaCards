// import { testEquivalence, translateToEnglish } from "@/koala/openai";
// import { captureTrainingData } from "./capture-training-data";
import { compare } from "./evaluator-utils";
import { QuizEvaluator } from "./types";
import { grammarCorrectionNG } from "../grammar-ng";

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

  const userMessage = `✏️${resp.correctedSentence || ""}`;

  switch (resp.grade) {
    case "correct":
      return { result: "pass", userMessage };
    case "incorrect":
    case "grammar":
      return { result: "fail", userMessage };
    default:
      return {
        result: "fail",
        userMessage: "An error occurred. Please report this.",
      };
  }
};
