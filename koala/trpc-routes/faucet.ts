import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
import { openai } from "../openai";

const SpeechTageSchema = z.object({
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

async function labelWords(
  // Comma seperated word list.
  words: string,
) {
  const PROMPT = `
  You are a specialized AI part-of-speech tagger.
  Your job is to label words with their part of speech
  for use in a language learning app.

  The labels are: "physical-object", "noun-not-object", "verb", "adjective", "other"

  Pay special attention to the distinction between "noun-not-object" and "physical-object".
  "noun-not-object" is for non-physical nouns (love, innovation, etc..)
  "physical-object" can only be used for nouns that are touchable (mountain, shovel, dog, etc..)
  `;
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: PROMPT },
      { role: "user" as const, content: words },
    ],
    model: "gpt-4o",
    temperature: 0.1,
    response_format: zodResponseFormat(SpeechTageSchema, "parts-of-speech"),
  });

  // Extract the parsed response from the API's output
  const parsedResponse = response.choices[0]?.message?.parsed;
  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  const results: Record<"objects" | "words" | "skip", string[]> = {
    objects: [],
    words: [],
    skip: [],
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
        results.skip.push(word.word);
    }
  });
  return results;
}

const ColocationSchema = z.object({
  colocations: z.array(
    z.object({
      target: z.string(),
      noun: z.string(),
      adjective: z.string(),
      verb: z.string(),
    }),
  ),
});

async function pairColocations(words: string) {
  const PROMPT = `
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
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: words },
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
const PhraseSchema = z.object({
  phrases: z.array(z.string()),
});

async function generatePhrases(words: string) {
  const PROMPT = `
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
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: PROMPT },
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

const TRANSLATION = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

const TranslationSchema = z.object({
  translations: TRANSLATION,
});

async function translatePhrases(words: string) {
  const PROMPT = `
  You are a language translator inside of a language learning app.
  You translate phrases from a target language to English.
  Your translations are used in flashcards.
  Your translations find a perfect balance between exposing the nuance of the language to a student
  while also sounding natural and easy to understand.
  `;
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: words },
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

export const faucet = procedure
  .input(
    z.object({
      words: z.string(),
    }),
  )
  .output(TRANSLATION)
  .mutation(async ({ ctx, input }) => {
    // I will fill this part out, don't worry about it for now.
    // Show it to you so you understand the schema.
    await getUserSettings(ctx.user?.id);
    const step1 = await labelWords(input.words);
    // Don't use 'skip' or 'objects' for now.
    const { words } = step1;
    console.log(`=== WORDS ===`);
    console.log(JSON.stringify(words, null, 2));
    const step2 = await pairColocations(words.join(", "));
    console.log(`=== COLOCATIONS ===`);
    console.log(JSON.stringify(step2, null, 2));
    // Combine target word with each colocation kind:
    const combined: string[] = step2
      .map((item, index) => {
        const conjugation = [
          "합니다 polite formal",
          "해요 polite informal",
          "한다 plain form",
        ][index % 3];
        return `Target: ${item.target} Colocations: ${item.noun},${item.adjective},${item.verb} Tense: ${conjugation}`;
      })
      .sort()
      .map((item, index) => `${index + 1}. ${item.toLowerCase()}`);
    console.log(`=== COMBINED ===`);
    console.log(JSON.stringify(combined, null, 2));
    const step3 = await generatePhrases(combined.join(", "));
    console.log(`=== PHRASES ===`);
    console.log(JSON.stringify(step3, null, 2));

    const step4 = await translatePhrases(step3.join(", "));
    console.log(`=== TRANSLATIONS ===`);
    console.log(JSON.stringify(step4, null, 2));

    return step4;
  });
