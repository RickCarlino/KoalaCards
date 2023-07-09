import { draw, shuffle } from "radash";
import { koreanGrammar } from "./korean-grammar";
import { koreanWords } from "./korean-words";
import { ask, askRaw } from "@/server/routers/main";

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

const CONF = {
  n: 4,
  temperature: 1,
};

function syllables(sentence: string): number {
  // Regular expression to match Korean syllables
  const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g;

  // Get an array of all Korean syllables in the sentence
  const koreanSyllables = sentence.match(koreanRegex);

  // Return the count of Korean syllables
  return koreanSyllables ? koreanSyllables.length : 0;
}

const randomGrammar = async () => {
  const grammar = draw(
    Object.entries(koreanGrammar).map((x) => x.join(" => "))
  );
  const prompt = [
    `Create a random phrase for a Korean language student using the grammar above.`,
    `The example MUST be less than 13 syllables in length.`,
    `Use a spoken 해요체 speech style.`,
    `Do not return anything except a Korean sentence.`,
  ].join("\n");
  const resp = await ask([grammar, `===`, prompt].join("\n"), CONF);
  return resp;
};

const randomVocab = async () => {
  const vocab = draw(koreanWords);
  const prompt = [
    `Create a random phrase for a Korean language student using the word above.`,
    `The example MUST be less than 13 syllables in length.`,
    `Use a spoken 해요체 speech style.`,
    `Do not return anything except a Korean sentence.`,
  ].join("\n");
  const resp = await ask([vocab, `===`, prompt].join("\n"), CONF);
  return resp;
};

const yesOrNo = async (content: string): Promise<"yes" | "no"> => {
  const answer = await askRaw({
    messages: [{ role: "user", content }],
    model: "gpt-4-0613", // GPT 3.5 is not good enough for this task.
    n: 3,
    temperature: 0.8,
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
  type KoEn = Record<"ko" | "en", string> | undefined;
  return answer.data.choices
    .map((x) => JSON.stringify(x.message?.function_call?.arguments))
    .map((x) => JSON.parse(x))[0] as KoEn;
};

const pickShortest = (sentences: string[]) => {
  return sentences.reduce((a, b) => (syllables(a) <= syllables(b) ? a : b));
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
    const untranslated = pickShortest(ok);
    if (untranslated) {
      return await translate(untranslated);
    }
  } catch (error) {
    console.warn("PHRASE ERROR: " + JSON.stringify(error, null, 2));
    return null;
  }
}

export const randomNew = async () => {
  for (let i = 0; i <= 3; i++) {
    const result = await maybeGeneratePhrase();
    if (result) {
      return result;
    }
  }
  throw new Error("randomNew function failed more than 3 times");
};
