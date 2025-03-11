import { openai } from "@/koala/openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const TRANSLATION = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

const TranslationSchema = z.object({
  translations: TRANSLATION,
});

const OBJ_TRANSLATION_PROMPT = `
You are a language AI inside of a language learning app.
You english definitions of words from a target language to English.
First, provide a one sentence definition. Be brief. Be concise. Provide only one definition.
Next, put the a parenthesized english translation of the word for simplicity.
Examples:
사람 => a human being (a person)
서울 => The capital city of South Korea (Seoul)
사과 => The round red fruit of the apple tree (an apple)
김치 => A traditional Korean dish of fermented vegetables (kimchi)
`;

export async function translateObject(words: string[]) {
  if (words.length < 1) {
    return [];
  }

  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: OBJ_TRANSLATION_PROMPT },
      { role: "user", content: words.join(", ") },
    ],
    model: "gpt-4o",
    response_format: zodResponseFormat(TranslationSchema, "translations"),
  });

  const parsedResponse = response.choices[0]?.message?.parsed;
  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }
  return parsedResponse.translations;
}
