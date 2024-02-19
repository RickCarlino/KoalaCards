import { YesOrNo, yesOrNo } from "@/utils/openai";
import { QuizEvaluator } from "./types";
import { template } from "radash";

const GRAMMAR_PROMPT = `Grade a sentence from a language learning
app. Answer YES if the sentence is grammatically correct and
in the specified language (ISO 639-1:2002 code '{{langCode}}').
Answer NO if it doesn't follow the language's syntax and semantics
or isn't in the specified language. Avoid vague responses.
Incomplete sentences are OK if they are grammatically correct.`;

const MEANING_PROMPT = `Grade the equivalence of a translation
in a language learning app, given the ISO 639-1:2002 language
code '{{langCode}}'. The original phrase is "{{definition}}",
with an ideal translation example "{{term}}". Answer
YES if the student's translation is equivalent, capturing the
original meaning without changing key details. Answer NO if
key details are altered or the meaning is not accurately
conveyed. Avoid vague responses.`;

const gradeGrammar = async (
  userInput: string,
  term: string,
  definition: string,
  langCode: string,
): Promise<YesOrNo> => {
  const tplData = {
    term,
    definition,
    langCode,
  };
  const content = template(GRAMMAR_PROMPT, tplData);
  const grammarYN = await yesOrNo(userInput, content);
  if (grammarYN.response === "no") {
    return grammarYN;
  }

  const meaningYn = await yesOrNo(userInput, template(MEANING_PROMPT, tplData));

  return meaningYn;
};

export const speaking: QuizEvaluator = async ({ userInput, card }) => {
  const result = await gradeGrammar(
    userInput,
    card.term,
    card.definition,
    card.langCode,
  );
  if (result.response === "no") {
    console.log(`Fail`);
    return {
      result: "fail",
      userMessage: result.whyNot || "No reason provided.",
    };
  }
  console.log("pass");
  return {
    result: "pass",
    userMessage: result.whyNot || "Passed!",
  };
};
