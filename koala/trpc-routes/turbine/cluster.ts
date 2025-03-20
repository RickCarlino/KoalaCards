import { openai } from "@/koala/openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { clean } from "./util";
import { template } from "radash";
import { ChatCompletionMessageParam } from "openai/resources";

const TRANSLATION = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

const ClusterSchema = z.object({
  clusters: TRANSLATION,
});

const SYSTEM_PROMPT = `
You are a language expert specializing in {{LANGUAGE}} second language acquisition and lexical chunks.
Your task is to generate natural, idiomatic "chunks"—collocations, common phrases,
or sentence stems—from a provided list of target words in {{LANGUAGE}}.

Instructions:

    Input: A list of target words in {{LANGUAGE}}.

    Task: For each target word, identify and output one cluster that:
        Is widely recognized as natural and idiomatic in everyday {{LANGUAGE}}.
        May be a collocation, idiomatic expression, sentence stem, or common phrase.
        Includes at least one of the target words.

    Output Format:
    For each target word, return one JSON object with the following structure:

    {"term": "<cluster in {{LANGUAGE}}>", "definition": "<English translation>"}

    Do not include any extra hints, commentary, or formatting beyond this structure.

    Quality Guidelines:
        Ensure the cluster is grammatically correct and idiomatic.
        Provide an accurate, natural English translation.
        Double-check for grammatical errors, non-idiomatic expressions, or mistranslations.

Examples of High Quality Chunks:

    진하다 ⇒ {"term": "진한 맛", "definition": "Strong flavor"}
    결정 ⇒ {"term": "결정을 내려요", "definition": "Make a decision."}
    기반 ⇒ {"term": "기반 기술을 구현했습니다", "definition": "I implemented the underlying technology."}
    멀리 ⇒ {"term": "멀리서 들려오는 소리", "definition": "A sound heard from afar."}
    굴다 ⇒ {"term": "못되게 굴다", "definition": "To behave badly."}
    생방송 ⇒ {"term": "생방송 시작합니다", "definition": "Live broadcast is starting."}
    여우 ⇒ {"term": "여우 같은 눈빛", "definition": "Fox-like gaze."}
    욕 ⇒ {"term": "욕하지 마세요", "definition": "Please don't curse."}
    공연 ⇒ {"term": "인상적인 공연", "definition": "An impressive performance."}

Avoid examples with poor grammar, non-idiomatic usage, or incorrect translations.
`;

const USER_PROMPT = `
Please generate clusters for the following target words:

{{WORDS}}

Double check your output when you are done.
`;

function tpl(x: any, y: any) {
  const z = template(x, y);
  console.log(`=====`);
  console.log(z);
  return z;
}

export async function clusters(words: string[], language = "Korean") {
  console.log("Hello??");
  if (words.length < 1) {
    return [];
  }

  const part1: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: tpl(SYSTEM_PROMPT, { LANGUAGE: language }),
    },
    {
      role: "user",
      content: tpl(USER_PROMPT, { WORDS: clean(words).join("\n") }),
    },
  ];

  const response1 = await openai.beta.chat.completions.parse({
    messages: part1,
    model: "gpt-4o",
  });

  const content = response1.choices[0]?.message?.content ?? "";

  const response2 = await openai.beta.chat.completions.parse({
    messages: [
      ...part1,
      {
        role: "assistant",
        content: content,
      },
      {
        role: "user",
        content:
          "For sentences containing '다' form verbs, update them to use '요' form instead. Leave others as is.",
      },
    ],
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: zodResponseFormat(ClusterSchema, "translations"),
  });

  const parsedResponse = response2.choices[0]?.message?.parsed;

  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  return parsedResponse.clusters;
}
