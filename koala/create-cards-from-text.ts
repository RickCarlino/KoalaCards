import { gptCall } from "./openai";

interface Card {
  definition: string;
  term: string;
  gender: "M" | "F" | "N";
}

const SYSTEM_PROMPT = `

  EXAMPLE INPUTS:

    Estoy cansado hoy.\tI am tired today.
    저는 간호사예요.\tI am a nurse.
    Je suis fatigué aujourd'hui.\tI am tired today.
    Hace buen tiempo hoy.\tThe weather is good today.
    Sono stanco oggi.\tI am tired today.
    Il fait beau aujourd'hui.\tThe weather is nice today.
    Oggi fa bel tempo.\tThe weather is nice today.
    저는 의사예요.\tI am a doctor.
    오늘 날씨가 좋네요.\tThe weather is nice today.
    Sono stanca oggi.\tI am tired today.
    Estoy cansada hoy.\tI am tired today.
    Je suis fatiguée aujourd'hui.\tI am tired today.

    EXAMPLE OUTPUT:

    {
      "cards": [
        {"term": Estoy cansado hoy.", "definition": "I am tired today., "gender": "M"},
        {"term": 저는 간호사예요.", "definition": "I am a nurse."gender": "F"},
        {"term": Je suis fatigué aujourd'hui.", "definition": "I am tired today., "gender": "M"},
        {"term": Hace buen tiempo hoy.", "definition": "The weather is good today., "gender": "N"},
        {"term": Sono stanco oggi.", "definition": "I am tired today., "gender": "M"},
        {"term": Il fait beau aujourd'hui.", "definition": "The weather is nice today., "gender": "N"},
        {"term": Oggi fa bel tempo.", "definition": "The weather is nice today., "gender": "N"},
        {"term": 저는 의사예요.", "definition": "I am a doctor., "gender": "M"},
        {"term": 오늘 날씨가 좋네요.", "definition": "The weather is nice today., "gender": "N"},
        {"term": Sono stanca oggi.", "definition": "I am tired today."gender": "F"},
        {"term": Estoy cansada hoy.", "definition": "I am tired today."gender": "F"},
        {"term": Je suis fatiguée aujourd'hui.", "definition": "I am tired today."gender": "F"},
      ]
    }

  INSTRUCTIONS:
  The user of a multi-language flashcard app for English speakers
  is attempting to enter unstructured learning data into the app.
  Your task is to structure this data into a JSON array of
  objects that contain term/definition string attributes.

  These flashcards will be used via text-to-speech. Pick a gender
  (M/F/N) for the TTS voice based on grammar and context.

  Your JSON output will be directly used in the app, so be
  sure to verify the order of term/definition (definition is
  always English), remove headers (if any), etc...
  `;

/** Ingests a body of text containing card data and asynchronously returns
 * structured term/definition pairs. */
export async function createCardsFromText(input: string): Promise<Card[]> {
  const x = await gptCall({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
