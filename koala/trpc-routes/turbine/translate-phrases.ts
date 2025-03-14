import { openai } from "@/koala/openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { clean } from "./util";

const TRANSLATION = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

const TranslationSchema = z.object({
  translations: TRANSLATION,
});

const PHRASE_TRANSLATION_PROMPT = "Translate the phrases to English.";

export async function translatePhrases(words: string[]) {
  if (words.length < 1) {
    return [];
  }

  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: PHRASE_TRANSLATION_PROMPT },
      { role: "user", content: "===\n" + clean(words).join("\n") },
    ],
    model: "gpt-4o",
    response_format: zodResponseFormat(TranslationSchema, "translations"),
    temperature: 0.1,
  });

  const parsedResponse = response.choices[0]?.message?.parsed;
  if (!parsedResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }
  return parsedResponse.translations;
}
