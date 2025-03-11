import { openai } from "@/koala/openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { clean } from "./util";

export type ColocationGroup = z.infer<typeof ColocationGroup>;

export const ColocationGroup = z.object({
  target: z.string(),
  noun: z.string(),
  adjective: z.string(),
  verb: z.string(),
});

const ColocationSchema = z.object({
  colocations: z.array(ColocationGroup),
});

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

export async function pairColocations(
  words: string[],
): Promise<ColocationGroup[]> {
  if (words.length < 1) {
    return [];
  }
  const response = await openai.beta.chat.completions.parse({
    messages: [
      { role: "system", content: COLOCATION_PROMPT },
      { role: "user", content: clean(words).join(", ") },
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
