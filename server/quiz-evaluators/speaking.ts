import { gptCall } from "@/utils/openai";
import { QuizEvaluator } from "./types";
import { template } from "radash";

const GRAMMAR_PROMPT = `
The sentence above was entered by the user of a language learning app.
You grade the grammar of phrases in the app.
Phrases are not always complete sentences, but they must follow the syntax and semantics of the language.
For example, "{{target}}" would be considered valid.
The ISO 639-1:2002 language code of the sentence is '{{langCode}}'.

Answer YES if the following are true:

1. The sentence is 100% grammatically correct.
2. The sentence is written in the specified language.

Answer NO if the following are true:
1. Sentence does not follow syntax and semantics of the language.
2. The sentence is not written in the specified language.

You will be penalized for vague responses.
`;

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

const gradeGrammar = async (
  userInput: string,
  target: string,
  langCode: string,
) => {
  const content = template(GRAMMAR_PROMPT, { target, langCode });
  console.log(userInput);
  console.log(content);
  const grammarResp = await gptCall({
    messages: [
      {
        role: "user",
        content: userInput,
      },
      {
        role: "system",
        content,
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
  console.log("====");
  const jsonString =
    grammarResp?.choices?.[0]?.message?.tool_calls?.[0].function.arguments ||
    "{}";
  console.log(JSON.parse(jsonString));
  console.log("TODO: This");
};

export const speaking: QuizEvaluator = async ({ userInput, card }) => {
  console.log("Speaking exam");
  await gradeGrammar(userInput, card.term, card.langCode);
  return {
    result: "pass",
    userMessage: "You passed the listening quiz!",
  };
};
