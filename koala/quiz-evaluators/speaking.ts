import { Explanation, testEquivalence, translateToEnglish, yesOrNo } from "@/koala/openai";
import { QuizEvaluator } from "./types";
import { template } from "radash";
import { strip } from "./evaluator-utils";
import { captureTrainingData } from "./capture-training-data";

// The previous prompt had a real world success rate of 72%.
// Let's see how this one does.
const MEANING_PROMPT = `Sentence B: ({{langCode}}): {{term}} / {{definition}}
  ---

  Consider the two sentences above. I have added English
  translations for clarity, but I only care about the original
  language ({{langCode}}).
  
  YOUR TASK:
  If the meanings of these two sentences are mostly the same,
  respond with 'YES.' If they are completely unrelated,
  respond with 'NO' and tell the student why.
`;

const doGrade = async (
  userInput: string,
  term: string,
  definition: string,
  langCode: string,
  userID: string,
): Promise<Explanation> => {
  const tplData = {
    term,
    definition,
    langCode,
  };

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

  const meaningYn = await yesOrNo({
    userInput: `Sentence A (${langCode}): ${userInput} / ${englishTranslation}`,
    question: template(MEANING_PROMPT, tplData),
    userID,
  });

  captureTrainingData({
    quizType: "speaking",
    yesNo: meaningYn.response,
    explanation: meaningYn.whyNot || "",
    term,
    definition,
    langCode,
    userInput,
    englishTranslation,
  });
  const trialData = await testEquivalence(term, userInput);
  if (trialData === meaningYn.response) {
    console.log(`=== old and new models agree.`);
  } else {
    console.log(`=== old and new models disagree!`);
    console.log({
      type: "speaking",
      fineTuned: trialData,
      gpt4: meaningYn.response,
      term,
      definition,
      langCode,
      userInput,
      response: meaningYn.response,
    });
  }

  return {
    ...meaningYn,
    whyNot: englishTranslation,
  };
};

export const speaking: QuizEvaluator = async ({ userInput, card, userID }) => {
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
    userID,
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
