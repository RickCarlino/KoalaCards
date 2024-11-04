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

type GrammarCorrrectionProps = {
  /** The Korean phrase. */
  term: string;
  /** An English translation */
  definition: string;
  /** Language code like KO */
  langCode: string;
  /** What the user said. */
  userInput: string;
};

const getLangcode = (lang: string) => {
  const names: Record<string, string> = {
    EN: "English",
    IT: "Italian",
    FR: "French",
    ES: "Spanish",
    KO: "Korean",
  };
  const key = lang.slice(0, 2).toUpperCase();
  return names[key] || lang;
};

export const grammarCorrection = async (
  props: GrammarCorrrectionProps,
): Promise<string | undefined> => {
  // Latest snapshot that supports Structured Outputs
  // TODO: Get on mainline 4o when it supports Structured Outputs
  const model = "gpt-4o-2024-08-06";
  const { userInput } = props;
  const lang = getLangcode(props.langCode);
  const prompt = [
    `Target language: ${lang}`,
    `Phrase: '${userInput}'.`,
    `Translation: '${props.definition}'`,
    `If the phrase is free of MAJOR grammar problems return:`,
    `{ "response": { "userWasCorrect": true } }`,
    `If the phrase has serious grammatical issues, return:`,
    `{ "response": { "userWasCorrect": false, "correctedSentence": "corrected sentence here" } }`,
  ].join("\n");

  const resp = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    model,
    max_tokens: 125,
    // top_p: 1,
    // frequency_penalty: 0,
    temperature: 0.1,
    response_format: zodResponseFormat(zodYesOrNo, "correct_sentence"),
  });
  const correct_sentence = resp.choices[0].message.parsed;
  if (correct_sentence) {
    if (!correct_sentence.response.userWasCorrect) {
      return correct_sentence.response.correctedSentence;
    }
  }
};
