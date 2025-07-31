import { generateStructuredOutput } from "./ai";
import { Gender } from "./shared-types";
import { z } from "zod";

interface Card {
  definition: string;
  term: string;
  gender: Gender;
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
        {"term": 저는 간호사예요.", "definition": "I am a nurse."gender": "F"},
        {"term": 저는 의사예요.", "definition": "I am a doctor., "gender": "M"},
        {"term": 오늘 날씨가 좋네요.", "definition": "The weather is nice today., "gender": "N"}
      ]
    }

  INSTRUCTIONS:

  You need to convert a variety of inputs into a structured
  format for a language learning flashcard app. The inputs
  could be in any format, and you must include
  the term, its English definition, and the appropriate gender
  for text-to-speech (TTS) voice, based on grammatical gender
  or the context of the term. The output should be in JSON,
  following the schema above. Ensure the term is in the
  target language and the definition in English, without
  altering their content.

  The target language for this upload is: `;

// Schema for card structure
const CardSchema = z.object({
  cards: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
      gender: z.enum(["M", "F", "N"]),
    }),
  ),
});

/** Ingests a body of text containing card data and asynchronously returns
 * structured term/definition pairs. */
export async function createCardsFromText(
  langCode: string,
  input: string,
): Promise<Card[]> {
  const response = await generateStructuredOutput({
    model: "openai:smart",
    messages: [
      { role: "system", content: SYSTEM_PROMPT + langCode },
      { role: "user", content: input.slice(0, 3000) },
    ],
    schema: CardSchema,
    temperature: 0.75,
  });

  return response.cards;
}
