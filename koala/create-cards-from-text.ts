import { gptCall } from "./openai";

interface Card {
  definition: string;
  term: string;
  gender: "M" | "F" | "N";
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

/** Ingests a body of text containing card data and asynchronously returns
 * structured term/definition pairs. */
export async function createCardsFromText(langCode: string, input: string): Promise<Card[]> {
  const x = await gptCall({
    messages: [
      { role: "system", content: SYSTEM_PROMPT + langCode},
      { role: "user", content: input.slice(0, 3000) },
    ],
    model: "gpt-3.5-turbo-1106",
    n: 1,
    temperature: 0.75,
    response_format: { type: "json_object" },
  });
  const cards: Card[] = JSON.parse(
    x.choices[0].message.content || "null",
  )?.cards;
  return cards;
}
