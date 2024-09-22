import {
  Explanation,
  grammarCorrection,
  testEquivalence,
  translateToEnglish,
} from "@/koala/openai";
import { QuizEvaluator, QuizEvaluatorOutput } from "./types";
import { strip } from "./evaluator-utils";
import { captureTrainingData } from "./capture-training-data";
import { prismaClient } from "../prisma-client";

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
    whyNot: englishTranslation,
  };
};

type X = {
  userInput: string;
  correction: string;
  isCorrect: boolean;
};

function gradeWithGrammarCorrection(i: X, what: string): QuizEvaluatorOutput {
  console.log(
    `=== Grading ${what} grammar correction:`,
    JSON.stringify(i, null, 2),
  );
  if (i.isCorrect) {
    return {
      result: "pass",
      userMessage: "Previously correct answer.",
    };
  } else {
    return {
      result: "fail",
      userMessage: `Say "${i.correction}" instead of "${i.userInput}".`,
    };
  }
}

export const speaking: QuizEvaluator = async ({ userInput, card }) => {
  if (strip(userInput) === strip(card.term)) {
    console.log(`=== Exact match! (53)`);
    return {
      result: "pass",
      userMessage: "Exact match. Nice work!",
    };
  }

  const prevResp = await prismaClient.speakingCorrection.findFirst({
    where: {
      cardId: card.id,
      userInput,
    },
  });

  if (prevResp) {
    return gradeWithGrammarCorrection(prevResp, "cached");
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

  const corrected = await grammarCorrection({
    userInput,
    langCode: card.langCode,
    term: card.term,
    definition: card.definition,
  });

  return gradeWithGrammarCorrection(
    await prismaClient.speakingCorrection.create({
      data: {
        cardId: card.id,
        isCorrect: !corrected,
        definition: card.definition,
        term: card.term,
        userInput,
        correction: corrected || userInput,
      },
    }),
    "new",
  );
};
