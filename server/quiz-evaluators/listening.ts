import { template } from "radash";
import { QuizEvaluator } from "./types";
import { yesOrNo } from "@/utils/openai";

const PROMPT = `
ISO 639-1:2002 language code: '{{langCode}}'.
Is the phrase above a correct translation of the phrase "{{term}}"?
If the answer is "no", provide a reason why. You will be penalized
for vague responses.`;
export const listening: QuizEvaluator = async (ctx) => {
  const { userInput, card } = ctx;
  const { term, definition, langCode } = card;
  const tplData = { term, definition, langCode };
  const question = template(PROMPT, tplData);
  const listeningYN = await yesOrNo({
    userInput,
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
