import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";
import { isApprovedUser } from "./is-approved-user";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  const result = await openai.chat.completions.create(opts);
  console.log(`=== GPT CALL ===`);
  console.log(opts.messages.map((x) => x.content || "").join("\n"));
  console.log(`=== GPT RESP ===`);
  const resp = result.choices[0].message || {};
  console.log(JSON.stringify(resp.content || resp.tool_calls?.[0], null, 2));
  return result;
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
export type YesOrNoInput = {
  userInput: string;
  question: string;
  userID: string;
};

// Usage is currently low enough that we can afford to use
// the more expensive model
const TEMPORARY_DEMO = true;

export const yesOrNo = async (input: YesOrNoInput): Promise<YesOrNo> => {
  const { userInput, question, userID } = input;
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
    model:
      isApprovedUser(userID) || TEMPORARY_DEMO
        ? "gpt-4-turbo-preview"
        : "gpt-3.5-turbo",
    tools: [
      {
        type: "function",
        function: YES_OR_NO_FUNCTION,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
    user: userID,
    tool_choice: { type: "function", function: { name: "yes_or_no" } },
  });
  const jsonString =
    grammarResp?.choices?.[0]?.message?.tool_calls?.[0].function.arguments ||
    "{}";
  return JSON.parse(jsonString);
};

export const translateToEnglish = async (content: string, langCode: string) => {
  const prompt = `You will be provided with a foreign language sentence (lang code: ${langCode}), and your task is to translate it into English.`;
  const hm = await gptCall({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content,
      },
    ],
    temperature: 0.7,
    max_tokens: 128,
    top_p: 1,
  });
  const val = hm.choices[0].message.content;
  if (!val) {
    throw new Error("No translation response from GPT-4.");
  }
  return val;
};
