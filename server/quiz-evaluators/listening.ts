import { template } from "radash";
import { QuizEvaluator } from "./types";
import { yesOrNo } from "@/utils/openai";

const PROMPT = `
ISO 639-1:2002 language code: '{{langCode}}'.
Is the phrase above a correct translation of the phrase "{{term}}"?
`;
export const listening: QuizEvaluator = async (ctx) => {
  const { userInput, card } = ctx;
  const { term, definition, langCode } = card;
  const tplData = { term, definition, langCode };
  const content = template(PROMPT, tplData);
  const listeningYN = await yesOrNo(userInput, content);

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
