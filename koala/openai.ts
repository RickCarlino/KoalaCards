import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";
import { YesNo } from "./shared-types";

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

const SIMPLE_YES_OR_NO = {
  name: "yes_or_no",
  parameters: {
    type: "object",
    properties: {
      response: {
        type: "string",
        enum: ["yes", "no"],
      },
    },
    dependencies: {
      response: {
        oneOf: [
          {
            properties: {
              response: { const: "no" },
            },
          },
          {
            properties: {
              response: { const: "yes" },
            },
          },
        ],
      },
    },
  },
  description: "Answer a yes or no question.",
};

export type Explanation = { response: YesNo; whyNot?: string };

export const testEquivalence = async (
  left: string,
  right: string,
): Promise<YesNo> => {
  const model = process.env.GPT_MODEL || "gpt-4o";
  const content = [left, right].map((s, i) => `${i + 1}: ${s}`).join("\n");
  const resp = await gptCall({
    messages: [
      {
        role: "user",
        content,
      },
      {
        role: "system",
        content: "Are these two sentences equivalent?",
      },
    ],
    model,
    tools: [
      {
        type: "function",
        function: SIMPLE_YES_OR_NO,
      },
    ],
    max_tokens: 100,
    temperature: 0.7,
    tool_choice: { type: "function", function: { name: "yes_or_no" } },
  });
  const jsonString =
    resp?.choices?.[0]?.message?.tool_calls?.[0].function.arguments || "{}";
  const raw: any = JSON.parse(jsonString);
  return raw.response as YesNo;
};

export const translateToEnglish = async (content: string, langCode: string) => {
  const prompt = `You will be provided with a foreign language sentence (lang code: ${langCode}), and your task is to translate it into English.`;
  const hm = await gptCall({
    model: "gpt-4o",
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
    return errorReport("No translation response from GPT-4.");
  }
  return val;
};

export const createDallEPrompt = async (term: string, definition: string) => {
  const prompt = [
    `You are a language learning flash card app.`,
    `You are creating a comic to help users remember the flashcard above.`,
    `It is a fun, single-frame, black and white comic that illustrates the sentence.`,
    `Create a DALL-e prompt to create this comic for the card above.`,
    `Do not add speech bubbles or text. It will give away the answer!`,
    `All characters must be Koalas.`,
  ].join("\n");
  const hm = await gptCall({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [`TERM: ${term}`, `DEFINITION: ${definition}`].join("\n"),
      },
      {
        role: "system",
        content: prompt,
      },
    ],
    temperature: 1.0,
    max_tokens: 128,
  });
  const val = hm.choices[0].message.content;
  if (!val) {
    return errorReport("No comic response from GPT-4.");
  }
  return val;
};

/** Returns a Base64 string. Creates a DALL-E image based on the provided prompt. */
export const createDallEImage = async (prompt: string) => {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
  });
  return response.data[0].url || "";
};
