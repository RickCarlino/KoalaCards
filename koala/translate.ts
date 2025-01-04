import { openai } from "./openai";

type TranslateFN = (langCode: string, input: string) => Promise<string>;
export const translate: TranslateFN = async (langCode, input) => {
  const translationPrompt = [
    "Please translate the following text into English in a natural-sounding way,",
    " without additional commentary or explanation.",
    `Language: "${langCode}"`,
    `Text: "${input}"`,
    "Translation:",
  ].join("\n");

  const translationResponse = await openai.chat.completions.create({
    messages: [{ role: "user", content: translationPrompt }],
    model: "gpt-4o",
    max_tokens: 125,
    temperature: 0.3,
  });

  return translationResponse.choices[0]?.message?.content?.trim() || "ERROR";
};
