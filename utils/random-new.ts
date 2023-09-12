import { draw, shuffle } from "radash";
import { koreanGrammar } from "./korean-grammar";
import { koreanWords } from "./korean-words";
import { Phrase } from "@prisma/client";
import { ingestOne } from "./ingest-phrases";
import { ask, askRaw } from "@/server/routers/perform-exam";
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
].join("\n");

const CONF = {
  n: 2,
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
  const conf = {
    ...CONF,
    best_of: 2,
  };
  const resp = await ask([data, `===`, prompt, GLOBAL_PROMPT].join("\n"), conf);
  return resp;
};

const randomGrammar = async () => {
  const x = Object.entries(koreanGrammar).map((x) => x.join(" => "));
  const grammar = draw(shuffle(x));
  const prompt = `Create a random phrase for a Korean language student using the grammar above.`;
  return askRandom(grammar, prompt);
};

const randomVocab = async (vocab = draw(shuffle(koreanWords))) => {
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

export const translate = async (ko: string) => {
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

const randomFn = () => draw(shuffle([randomGrammar, randomVocab]));

export async function maybeGeneratePhrase(fn = randomFn()) {
  try {
    if (!fn) throw new Error("No function found");
    const sentences = (await fn()).filter((p) => syllables(p) < 13);
    const ok: string[] = [];
    for (const sentence of sentences) {
      const p = `Is this AI-generated sentence grammatically correct, not awkward and suitable Korean language studies?: ${sentence}`;
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

export const wordCount = (input: string): number => {
  return input.split(" ").filter((word) => word.trim() !== "").length;
};

// == I AM LEAVING THIS HERE ==
// Phrase generation was a fun experiment, and I continue to
// use it, but it is not stable or reliable enough for use by
// all. TODO: Re-visit this experiment some day or spin this
// off as a CLI tool for advanced users.
// == I AM LEAVING THIS HERE ==
//
// async function maybeGenerateSmallerPhrase(input: KoEn): Promise<KoEn[]> {
//   if (!input) {
//     return [];
//   }

//   if (wordCount(input.ko) < 6) {
//     return [input];
//   }

//   const content = [
//     input.ko,
//     "\n",
//     input.en,
//     "\n",
//     '===',
//     `The example sentence above is too long. Break it down into smaller sentences.`,
//   ].join(" ");
//   const answer = await askRaw({
//     messages: [{ role: "user", content }],
//     model: "gpt-4-0613",
//     n: 1,
//     temperature: 0.3,
//     function_call: {
//       name: "create_phrases",
//     },
//     functions: [
//       {
//         name: "create_phrases",
//         description: "Create an array of new phrases from a larger phrase.",
//         parameters: {
//           required: ["translationPairs"],
//           type: "object",
//           properties: {
//             translationPairs: {
//               type: "array",
//               description: "An array of translation pair objects.",
//               items: {
//                 type: "object",
//                 properties: {
//                   ko: {
//                     type: "string",
//                     description: "A Korean sentence.",
//                   },
//                   en: {
//                     type: "string",
//                     description: "An English translation of the Korean phrase.",
//                   },
//                 },
//                 required: ["ko", "en"],
//               },
//             },
//           },
//         },
//       },
//     ],
//   });
//   const json = answer.data.choices[0].message?.function_call?.arguments;
//   const clean: KoEn[] = JSON.parse(json ? json : '{"translationPairs": []}')?.translationPairs;
//   if (Array.isArray(clean)) {
//     return clean.filter((x) => x && wordCount(x.ko) < 6);
//   }
//   throw new Error("Malformed GPT-4 response: " + json);
// }

// export async function phraseFromUserInput(
//   term: string,
//   definition: string,
// ): Promise<KoEn[]> {
//   const content = [
//     `Create a random phrase for a Korean learner using the`,
//     `word "${term}" (as in "${definition}").`,
//     `It is important that the sentence be very short.`,
//     `Sentences must be conjugated in the -요 form.`,
//     `Don't say '당신', '그녀' or other English-isms.`,
//   ].join(" ");
//   const answer = await askRaw({
//     messages: [
//       {
//         role: "user",
//         content,
//       },
//     ],
//     model: "gpt-4-0613", // GPT 3.5 is not good enough for this task.
//     n: 1,
//     temperature: 0.3,
//     function_call: {
//       name: "create_phrase",
//     },
//     functions: [
//       {
//         name: "create_phrase",
//         description: "Create a new phrase with translation pair.",
//         parameters: {
//           required: ["ko", "en"],
//           type: "object",
//           properties: {
//             ko: {
//               type: "string",
//               description:
//                 "A Korean sentence without notes, transliterations and romanization.",
//             },
//             en: {
//               type: "string",
//               description:
//                 "An English translation of the Korean sentence provided.",
//             },
//           },
//         },
//       },
//     ],
//   });
//   const json = answer.data.choices[0].message?.function_call?.arguments;
//   if (!json) {
//     throw new Error("Phrase import failed to generate GPT-4 response.");
//   }
//   const clean = JSON.parse(json);
//   if (clean && typeof clean.ko === "string" && typeof clean.en === "string") {
//     return maybeGenerateSmallerPhrase(clean);
//   } else {
//     throw new Error("Malformed GPT-4 response: " + json);
//   }
// }

export const randomNew = async () => {
  const results: Phrase[] = [];
  for (let i = 0; i <= 3; i++) {
    const all = (await maybeGeneratePhrase()) || [];
    for (const result of all) {
      if (result) {
        const phrase = await ingestOne(result.ko, result.en, "FIXME!!");
        phrase && results.push(phrase);
      }
    }
  }
  return results;
};
