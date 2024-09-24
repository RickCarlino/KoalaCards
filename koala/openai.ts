import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";
import { YesNo } from "./shared-types";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return await openai.chat.completions.create(opts);
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

const zodYesOrNo = z.object({
  response: z.union([
    z.object({
      userWasCorrect: z.literal(true),
    }),
    z.object({
      userWasCorrect: z.literal(false),
      correctedSentence: z.string(),
    }),
  ]),
});

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

type GrammarCorrrectionProps = {
  term: string;
  definition: string;
  langCode: string;
  userInput: string;
};

export const grammarCorrection = async (
  props: GrammarCorrrectionProps,
): Promise<string | undefined> => {
  // Latest snapshot that supports Structured Outputs
  // TODO: Get on mainline 4o when it supports Structured Outputs
  const model = "gpt-4o-2024-08-06";
  const { userInput } = props;
  const prompt = [
    `I want to say '${props.definition}' in language: ${props.langCode}.`,
    `Is '${userInput}' OK?`,
    `Correct awkwardness or major grammatical issues, if any.`,
  ].join("\n");

  const resp = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    model,
    max_tokens: 150,
    top_p: 1,
    frequency_penalty: 0,
    stop: ["\n"],
    temperature: 0.2,
    response_format: zodResponseFormat(zodYesOrNo, "correct_sentence"),
  });
  const correct_sentence = resp.choices[0].message.parsed;
  if (correct_sentence) {
    if (!correct_sentence.response.userWasCorrect) {
      return correct_sentence.response.correctedSentence;
    }
  }
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

const SENTENCE = [
  `You are a language learning flash card app.`,
  `You are creating a comic to help users remember the flashcard above.`,
  `It is a fun, single-frame, black and white comic that illustrates the sentence.`,
  `Create a DALL-e prompt to create this comic for the card above.`,
  `Do not add speech bubbles or text. It will give away the answer!`,
  `All characters must be Koalas.`,
].join("\n");

const SINGLE_WORD = [
  `You are a language learning flash card app.`,
  `Create a DALL-e prompt to generate an image of the foreign language word above.`,
  `Make it as realistic and accurate to the words meaning as possible.`,
  `The illustration must convey the word's meaning to the student.`,
  `Do not add text. It will give away the answer!`,
].join("\n");

export const createDallEPrompt = async (term: string, definition: string) => {
  const shortCard = term.split(" ").length < 2;
  const prompt = shortCard ? SINGLE_WORD : SENTENCE;
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
