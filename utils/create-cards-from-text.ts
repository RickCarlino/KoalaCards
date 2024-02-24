import { gptCall } from "./openai";

interface Card {
  definition: string;
  term: string;
}

const SYSTEM_PROMPT = `

  EXAMPLE INPUTS:

    "Kimchi: 김치\nRice: 밥"
    "Kimchi,김치\nRice,밥"
    "Kimchi\t김치\nRice\t밥"
    "한잔 정도가 적당합니다\tOne glass is just right

    EXAMPLE OUTPUT:

    {
      "cards": [
        { "definition": "Kimchi", term: "김치" },
        { "definition": "Rice", term: "밥" },
      ]
    }

  INSTRUCTIONS:
  The user of a multi-language flashcard app for English speakers
  is attempting to enter unstructured learning data into the app.
  Your task is to structure this data into a JSON array of
  objects that contain term/definition string attributes.

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
