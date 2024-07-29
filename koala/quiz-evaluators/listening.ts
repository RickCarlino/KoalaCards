import { template } from "radash";
import { QuizEvaluator } from "./types";
import { testEquivalence, yesOrNo } from "@/koala/openai";
import { strip } from "./evaluator-utils";
import { captureTrainingData } from "./capture-training-data";

const PROMPT = `
This should roughly translate to "{{definition}}" in English.
Evaluate the user's translation. Say "YES" if the translation
captures the general meaning effectively, even if it's not a
perfect match. Say "NO" if it fails to capture the intended meaning.
Briefly tell the student why they are wrong if answer is "NO".
`;

const PROMPT2 = `The user translated the sentence "{{term}}" (lang code: {{langCode}}) to English as "{{userInput}}". Keep in mind that this was transcribed via text-to-speech, so transcription errors are possible.`;

export const listening: QuizEvaluator = async (ctx) => {
  const { userInput, card } = ctx;
  const { term, definition, langCode } = card;
  const tplData = { term, definition, langCode, userInput };

  if (strip(userInput) === strip(definition)) {
    console.log(`=== Exact match! (23)`);
    return {
      result: "pass",
      userMessage: "Exact match. Nice work!",
    };
  }

  const question = template(PROMPT, tplData);
  const listeningYN = await yesOrNo({
    userInput: template(PROMPT2, tplData),
    question,
    userID: ctx.userID,
  });

  const trialData = await testEquivalence(definition, userInput);
  if (trialData === listeningYN.response) {
    console.log(`=== old and new models agree.`);
  } else {
    console.log(`=== old and new models disagree!`);
    console.log({
      type: "listening",
      fineTuned: trialData,
      gpt4: listeningYN.response,
      term,
      definition,
      langCode,
      userInput,
      response: listeningYN.response,
    });
  }
  captureTrainingData({
    quizType: "listening",
    yesNo: listeningYN.response,
    explanation: listeningYN.whyNot || "",
    term,
    definition,
    langCode,
    userInput,
    englishTranslation: "",
  });

  if (listeningYN.response === "no") {
    return {
      result: "fail",
      userMessage: listeningYN.whyNot || "No explanation provided.",
    };
  }

  return {
    result: "pass",
    userMessage: "You passed the listening quiz!",
  };
};
