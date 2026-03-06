import { generateStructuredOutput } from "./ai";
import { z } from "zod";

interface Card {
  definition: string;
  term: string;
}

const SYSTEM_PROMPT = `

  EXAMPLE INPUTS (non-exhaustive):
    저는 간호사예요.: I am a nurse.
    오늘 날씨가 좋네요. / The weather is nice today.
    오늘 날씨가 좋네요. (The weather is nice today.)
    저는 간호사예요.
      I am a nurse.
    저는 간호사예요., I am a nurse.
    저는 의사예요.; I am a doctor.
    저는 의사예요. I am a doctor.

  EXAMPLE OUTPUT:
    {
      "cards": [
        {"term": "저는 간호사예요.", "definition": "I am a nurse."},
        {"term": "저는 의사예요.", "definition": "I am a doctor."},
        {"term": "오늘 날씨가 좋네요.", "definition": "The weather is nice today."}
      ]
    }

  INSTRUCTIONS:

  You need to convert a variety of inputs into a structured
  format for a language learning flashcard app. The inputs
  could be in any format, and you must include
  the term and its English definition. The output should be in
  JSON, following the schema above. Ensure the term is in the
  target language and the definition in English, without
  altering their content.

  The target language for this upload is: `;

const CardSchema = z.object({
  cards: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
});

export async function createCardsFromText(
  langCode: string,
  input: string,
): Promise<Card[]> {
  const response = await generateStructuredOutput({
    model: "cheap",
    messages: [
      { role: "system", content: SYSTEM_PROMPT + langCode },
      { role: "user", content: input.slice(0, 3000) },
    ],
    schema: CardSchema,
    maxTokens: 10000,
  });

  return response.cards;
}
