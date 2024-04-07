import { YesOrNo, translateToEnglish, yesOrNo } from "@/koala/openai";
import { QuizEvaluator } from "./types";
import { template } from "radash";
import { FOOTER, strip } from "./evaluator-utils";

const MEANING_PROMPT =
  `Sentence B: ({{langCode}}): {{term}} / {{definition}}

When translated, is sentence A equivalent to sentence B?
The meaning is more important than the words used.
If "NO", why not? You must explain your reason.
Punctuation and spacing do not matter for the sake of this question.
` + FOOTER;

const doGrade = async (
  userInput: string,
  term: string,
  definition: string,
  langCode: string,
  userID: string,
): Promise<YesOrNo> => {
  const tplData = {
    term,
    definition,
    langCode,
  };
  const englishTranslation = await translateToEnglish(userInput, langCode);

  const meaningYn = await yesOrNo({
    userInput: `Sentence A (${langCode}): ${userInput} / ${englishTranslation}`,
    question: template(MEANING_PROMPT, tplData),
    userID,
  });

  meaningYn.whyNot = `Your sentences means '${englishTranslation}', rather than '${definition}'.`
  return meaningYn;
};

export const speaking: QuizEvaluator = async ({ userInput, card, userID }) => {
  if (strip(userInput) === strip(card.term)) {
    console.log(`=== Exact match!`);
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

  const userMessage = result.whyNot || "";

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
