import { gptCall } from "@/utils/openai";
import { QuizEvaluator } from "./types";
import { template } from "radash";

const GRAMMAR_PROMPT = `Grade a sentence from a language learning
app. Answer YES if the sentence is grammatically correct and
in the specified language (ISO 639-1:2002 code '{{langCode}}').
Answer NO if it doesn't follow the language's syntax and semantics
or isn't in the specified language. Avoid vague responses.`;

const MEANING_PROMPT = `Grade the equivalence of a translation
in a language learning app, given the ISO 639-1:2002 language
code '{{langCode}}'. The original phrase is "{{definition}}",
with an ideal translation example "{{term}}". Answer
YES if the student's translation is equivalent, capturing the
original meaning without changing key details. Answer NO if
key details are altered or the meaning is not accurately
conveyed. Avoid vague responses.`;

const YES_OR_NO_FUNCTION = {
  name: "yes_or_no",
  parameters: {
    type: "object",
    properties: {
      response: {
        type: "string",
        enum: ["yes", "no"],
      },
      whyNot: {
        type: "string",
      },
    },
    dependencies: {
      response: {
        oneOf: [
          {
            properties: {
              response: { const: "no" },
            },
            required: ["whyNot"],
          },
          {
            properties: {
              response: { const: "yes" },
            },
            not: {
              required: ["whyNot"],
            },
          },
        ],
      },
    },
  },
  description: "Answer a yes or no question.",
};

type YesOrNo = { response: "yes" | "no"; whyNot?: string };

const yesOrNo = async (
  userInput: string,
  question: string,
): Promise<YesOrNo> => {
  console.log("===");
  console.log(userInput);
  console.log(question);
  const grammarResp = await gptCall({
    messages: [
      {
        role: "user",
        content: userInput,
      },
      {
        role: "system",
        content: question,
      },
    ],
    model: "gpt-3.5-turbo",
    tools: [
      {
        type: "function",
        function: YES_OR_NO_FUNCTION,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
    tool_choice: { type: "function", function: { name: "yes_or_no" } },
  });
  const jsonString =
    grammarResp?.choices?.[0]?.message?.tool_calls?.[0].function.arguments ||
    "{}";
  return JSON.parse(jsonString);
};
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
  console.log("Speaking exam");
  const result = await gradeGrammar(
    userInput,
    card.term,
    card.definition,
    card.langCode,
  );
  if (result.response === "no") {
    return {
      result: "fail",
      userMessage: result.whyNot || "No reason provided.",
    };
  }
  return {
    result: "pass",
    userMessage: result.whyNot || "Passed!",
  };
};
