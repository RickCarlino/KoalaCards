import { draw, shuffle } from "radash";
import { koreanGrammar } from "./korean-grammar";
import { koreanWords } from "./korean-words";
import { ask, askRaw } from "@/server/routers/main";
import { appendFileSync } from "fs";
import { prismaClient } from "@/server/prisma-client";
import { Phrase } from "@prisma/client";
type KoEn = Record<"ko" | "en", string> | undefined;

const YES_OR_NO = {
  name: "answer",
  parameters: {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
      response: {
        type: "string",
        description: "Answer to a yes or no question.",
        enum: ["yes", "no"],
      },
      why: {
        type: "string",
        description:
          "Justification for the answer. Only required if answer is 'no'",
      },
    },
    required: ["response"],
    dependencies: {
      response: {
        oneOf: [
          {
            properties: {
              response: { enum: ["yes"] },
            },
          },
          {
            properties: {
              response: { enum: ["no"] },
              why: { type: "string" },
            },
            required: ["why"],
          },
        ],
      },
    },
  },
};

const KO_EN = {
  name: "translate",
  description:
    "Turn unstructured Korean sentence into clean KO/EN translation pair.",
  parameters: {
    required: ["ko", "en"],
    type: "object",
    properties: {
      ko: {
        type: "string",
        description:
          "A Korean sentence without notes, transliterations and romanization.",
      },
      en: {
        type: "string",
        description: "An English translation of the Korean sentence.",
      },
    },
  },
};

const GLOBAL_PROMPT = [
  `The example MUST be less than 13 syllables in length.`,
  `Conjugate all sentences in the -요 form.`,
  `Do not return anything except a Korean sentence.`,
  `Only use modern grammar, no archaic speech.`,
].join("\n");

const CONF = {
  n: 4,
  temperature: 1,
  model: "gpt-4", // GPT 3.5 is not good enough for this task.
};

function syllables(sentence: string): number {
  // Regular expression to match Korean syllables
  const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g;

  // Get an array of all Korean syllables in the sentence
  const koreanSyllables = sentence.match(koreanRegex);

  // Return the count of Korean syllables
  return koreanSyllables ? koreanSyllables.length : 0;
}
const askRandom = async (data: string | null, prompt: string) => {
  if (!data) {
    throw new Error("No data to prompt on");
  }
  const resp = await ask([data, `===`, prompt, GLOBAL_PROMPT].join("\n"), CONF);
  return resp;
};

const randomGrammar = async () => {
  const x = Object.entries(koreanGrammar).map((x) => x.join(" => "));
  const grammar = draw(shuffle(x));
  const prompt = `Create a random phrase for a Korean language student using the grammar above.`;
  return askRandom(grammar, prompt);
};

const randomVocab = async () => {
  const vocab = draw(shuffle(koreanWords));
  const prompt = `Create a random phrase for a Korean language student using the word above.`;
  return askRandom(vocab, prompt);
};

const yesOrNo = async (content: string): Promise<"yes" | "no"> => {
  const answer = await askRaw({
    messages: [{ role: "user", content }],
    model: "gpt-4-0613", // GPT 3.5 is not good enough for this task.
    n: 3,
    temperature: 1.0,
    function_call: { name: "answer" },
    functions: [YES_OR_NO],
  });
  const result = answer.data.choices
    .map((x) => JSON.stringify(x.message?.function_call))
    .map((x) => JSON.parse(JSON.parse(x).arguments).why)
    .filter((x) => !!x);
  return result.length === 0 ? "yes" : "no";
};

const translate = async (ko: string) => {
  const content = `Translate the sentence: ${ko}`;
  const answer = await askRaw({
    messages: [{ role: "user", content }],
    model: "gpt-4-0613", // GPT 3.5 is not good enough for this task.
    n: 1,
    temperature: 0.8,
    function_call: {
      name: "translate",
    },
    functions: [KO_EN],
  });
  const resp = answer.data.choices
    .map((x) => JSON.stringify(x.message?.function_call?.arguments))
    .map((x) => JSON.parse(x))[0];
  return JSON.parse(resp) as KoEn;
};

export async function maybeGeneratePhrase() {
  try {
    const fn = draw(shuffle([randomGrammar, randomVocab]));
    if (!fn) throw new Error("No function found");
    const sentences = (await fn()).filter((p) => syllables(p) < 13);
    const ok: string[] = [];
    for (const sentence of sentences) {
      const p = `Is this AI-generated sentence suitable for a Korean language student?: ${sentence}`;
      if ((await yesOrNo(p)) == "yes") {
        ok.push(sentence);
      }
    }
    const output: KoEn[] = [];
    for (const sentence of ok) {
      const translation = await translate(sentence);
      if (translation) {
        output.push(translation);
      }
    }
    return output;
  } catch (error) {
    console.warn("PHRASE ERROR: " + JSON.stringify(error, null, 2));
    return null;
  }
}

export const randomNew = async () => {
  const results: Phrase[] = [];
  for (let i = 0; i <= 3; i++) {
    const all = (await maybeGeneratePhrase()) || [];
    for (const result of all) {
      if (result) {
        const text = Object.values(result)
          .map((x) => JSON.stringify(x))
          .join(", ");
        appendFileSync("phrases.txt", text + "\n", "utf8");
        // Insert phrase into Prisma database:
        const phrase = await prismaClient.phrase.create({
          data: {
            term: result.ko,
            definition: result.en,
          },
        });
        results.push(phrase);
      }
    }
  }
  return results;
};
