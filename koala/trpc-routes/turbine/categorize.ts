import { openai } from "@/koala/openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { clean } from "./util";

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

const LABEL_PROMPT = `
You are a specialized AI part-of-speech tagger.
Your job is to label words with their part of speech
for use in a language learning app.

The labels are: "physical-object", "noun-not-object", "verb", "adjective", "other"

Pay special attention to the distinction between "noun-not-object" and "physical-object".
"noun-not-object" is for non-physical nouns (love, innovation, etc..)
"physical-object" can only be used for nouns that are touchable (mountain, shovel, dog, etc..)
`;

export async function categorizeWords(words: string[]) {
  const results: Record<"objects" | "words" | "misc", string[]> = {
    objects: [],
    words: [],
    misc: [],
  };

  if (words.length < 1) {
    return results;
  }

  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: LABEL_PROMPT },
      { role: "user" as const, content: clean(words).join(", ") },
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
