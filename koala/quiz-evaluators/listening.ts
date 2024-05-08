import { template } from "radash";
import { QuizEvaluator } from "./types";
import { yesOrNo } from "@/koala/openai";
import { strip } from "./evaluator-utils";

const PROMPT = `
This should roughly translate to "{{definition}}" in English.
Evaluate the user's translation.
Is this translation generally accurate?
Say "YES" if it captures the meaning effectively.
Say "NO" if it is completely incorrect. Explain why if "NO".
`;

export const listening: QuizEvaluator = async (ctx) => {
  const { userInput, card } = ctx;
  const { term, definition, langCode } = card;
  const tplData = { term, definition, langCode };
  const question = template(PROMPT, tplData);

  if (strip(userInput) === strip(definition)) {
    console.log(`=== Exact match! (23)`);
    return {
      result: "pass",
      userMessage: "Exact match. Nice work!",
    };
  }

  const listeningYN = await yesOrNo({
    userInput: `The user translated the sentence "{{term}}" (lang code: {{langCode}}) to English as "{{userInput}}".`,
    question,
    userID: ctx.userID,
  });

  if (listeningYN.response === "no") {
    return {
      result: "fail",
      userMessage: listeningYN.response,
    };
  }

  return {
    result: "pass",
    userMessage: "You passed the listening quiz!",
  };
};
