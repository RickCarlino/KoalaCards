import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return openai.chat.completions.create(opts);
}

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

export type YesOrNo = { response: "yes" | "no"; whyNot?: string };

export const yesOrNo = async (
  userInput: string,
  question: string,
): Promise<YesOrNo> => {
  console.log([userInput, question]);
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
