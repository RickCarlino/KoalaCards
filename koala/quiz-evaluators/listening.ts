import { template } from "radash";
import { QuizEvaluator } from "./types";
import { yesOrNo } from "@/koala/openai";
import { strip } from "./evaluator-utils";

const PROMPT =
  `
The user was asked to translate the sentence "{{term}}"
(lang code: {{langCode}}) to English. This to "{{definition}}"
in English.

Is the user's translation mostly correct? Say "YES" if so.
If "NO", explain why it is not correct.
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
    userInput: `User provided translation: ${userInput} (EN)`,
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
