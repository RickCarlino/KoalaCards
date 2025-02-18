import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
import { openai } from "../openai";

type ColocationGroup = z.infer<typeof ColocationGroup>;

const SpeechLabelSchema = z.object({
  words: z.array(
    z.object({
      word: z.string(),
      partOfSpeech: z.union([
        z.literal("physical-object"),
        z.literal("noun-not-object"),
        z.literal("verb"),
        z.literal("adjective"),
        z.literal("other"),
      ]),
    }),
  ),
});

const ColocationGroup = z.object({
  target: z.string(),
  noun: z.string(),
  adjective: z.string(),
  verb: z.string(),
});

const ColocationSchema = z.object({
  colocations: z.array(ColocationGroup),
});

const TRANSLATION = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

const TranslationSchema = z.object({
  translations: TRANSLATION,
});

const PhraseSchema = z.object({
  phrases: z.array(z.string()),
});

const LABEL_PROMPT = `
You are a specialized AI part-of-speech tagger.
Your job is to label words with their part of speech
for use in a language learning app.

The labels are: "physical-object", "noun-not-object", "verb", "adjective", "other"

Pay special attention to the distinction between "noun-not-object" and "physical-object".
"noun-not-object" is for non-physical nouns (love, innovation, etc..)
"physical-object" can only be used for nouns that are touchable (mountain, shovel, dog, etc..)
`;

const COLOCATION_PROMPT = `
You are a specialized AI colocations finder.
For each item in the list, add the most statistically likely noun,
adjective and verb to be co-located in a sentence that contains the target word.
all words must be converted to "dictionary form".

Return the result as JSON in the following format:
{
  "colocations": [
    { "target": "word", "noun": "noun", "adjective": "adjective", "verb": "verb" },
    ...
  ]
}
`;

const PHRASE_GENERATION_PROMPT = `
You are a specialized AI phrase generator inside of a language learning app.
You make short, grammatically correct, realistic phrases by combining colocations.
For each item in the list:

1. Look at the three colocations. Pick the one that is most likely to be used in a sentence that contains the target word.
2. Combine the target word with the chosen colocation to produce a short, grammatically correct, realistic verb phrase, noun phrase, or adjective phrase.
3. If (and only if!) the phrase is a verb phrase, conjugate using the provided conjugation style.
4. Double check your work to make sure the phrase is grammatically correct and realistic.

Keep in mind:
 * This is being used for language education, so the correctness and realism of the phrases is very important.
 * The words are provided in "dictionary form" but you are allowed and encouraged to make changes by adding particles, conjugations and verb endings.
`;

const PHRASE_TRANSLATION_PROMPT = `
You are a language translator inside of a language learning app.
You translate phrases and words from the target language to English.
Your translations are used in flashcards.
Your translations find a perfect balance between exposing the nuance of the language to a student
while also sounding natural and easy to understand.
`;

const OBJ_TRANSLATION_PROMPT = `
You are a language AI inside of a language learning app.
You english definitions of words from a target language to English.
First, provide a one sentence definition.
Then, put the a parenthesized english translation of the word for simplicity.
Examples:
사람 => a human being (a person)
서울 => The capital city of South Korea (Seoul)
사과 => The round red fruit of the apple tree (an apple)
김치 => A traditional Korean dish of fermented vegetables (kimchi)
`;

async function labelWords(words: string[]) {
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: LABEL_PROMPT },
      { role: "user" as const, content: words.join(", ") },
    ],
    model: "gpt-4o",
    temperature: 0.1,
    response_format: zodResponseFormat(SpeechLabelSchema, "parts-of-speech"),
  });

  // Extract the parsed response from the API's output
  const parsedResponse = response.choices[0]?.message?.parsed;
  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  const results: Record<"objects" | "words" | "misc", string[]> = {
    objects: [],
    words: [],
    misc: [],
  };
  parsedResponse.words.forEach((word) => {
    switch (word.partOfSpeech) {
      case "physical-object":
        results.objects.push(word.word);
        break;
      case "noun-not-object":
      case "verb":
      case "adjective":
        results.words.push(word.word);
        break;
      default:
        results.misc.push(word.word);
    }
  });
  return results;
}

async function pairColocations(words: string[]): Promise<ColocationGroup[]> {
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: COLOCATION_PROMPT },
      { role: "user", content: words.join(", ") },
    ],
    model: "gpt-4o",
    temperature: 0.1,
    response_format: zodResponseFormat(ColocationSchema, "colocations"),
  });

  const parsedResponse = response.choices[0]?.message?.parsed;
  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }
  return parsedResponse.colocations;
}

async function generatePhrases(colocations: ColocationGroup[]) {
  const words = colocations
    .map((item, index) => {
      const conjugations = [
        "plain present (ex: 한다)",
        "polite formal present (ex: 합니다)",
        "polite informal preset (ex: 해요)",
        "casual present (ex: 해)",
        "polite formal past (ex: 했습니다)",
        "polite informal past (ex: 했어요)",
        "casual past (ex: 했어)",
      ];
      const conjugation = conjugations[index % conjugations.length];
      return `Target: ${item.target} Colocations: ${item.noun},${item.adjective},${item.verb} Tense: ${conjugation}`;
    })
    .sort()
    .map((item, index) => `${index + 1}. ${item.toLowerCase()}`)
    .join("\n");

  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: PHRASE_GENERATION_PROMPT },
      { role: "user", content: words },
    ],
    model: "o3-mini",
    reasoning_effort: "high",
    response_format: zodResponseFormat(PhraseSchema, "phrases"),
  });

  const parsedResponse = response.choices[0]?.message?.parsed;
  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }
  return parsedResponse.phrases;
}

async function translatePhrases(words: string[]) {
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: PHRASE_TRANSLATION_PROMPT },
      { role: "user", content: words.join(", ") },
    ],
    model: "o3-mini",
    reasoning_effort: "medium",
    response_format: zodResponseFormat(TranslationSchema, "translations"),
  });

  const parsedResponse = response.choices[0]?.message?.parsed;
  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }
  return parsedResponse.translations;
}

async function translateObject(words: string[]) {
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: OBJ_TRANSLATION_PROMPT },
      { role: "user", content: words.join(", ") },
    ],
    model: "o3-mini",
    reasoning_effort: "medium",
    response_format: zodResponseFormat(TranslationSchema, "translations"),
  });

  const parsedResponse = response.choices[0]?.message?.parsed;
  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }
  return parsedResponse.translations;
}

const processWords = async (step1: string[]) => {
  const step2 = await pairColocations(step1);
  const step3 = await generatePhrases(step2);
  const step4 = await translatePhrases(step3);
  return step4;
};

export const turbine = procedure
  .input(
    z.object({
      words: z.string(),
    }),
  )
  .output(TRANSLATION)
  .mutation(async ({ ctx, input }) => {
    await getUserSettings(ctx.user?.id);
    const inputWords = input.words
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter((x) => x.length > 1)
      .sort();
    const step1 = await labelWords(inputWords);
    return [
      ...(await processWords(step1.words)),
      ...(await translateObject(step1.objects)),
      ...(await translatePhrases(step1.misc)),
    ];
  });
