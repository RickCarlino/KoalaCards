import { gptCall } from "@/server/routers/perform-exam";

interface Card {
  definition: string;
  term: string;
}

const SYSTEM_PROMPT = `

  === EXAMPLE INPUTS
  under 30 km/h.	시속 30km 이하	  
  Purchased a dishwasher: 식기세척기를 구매했어요.	
  Just doing my best. / 최선을 다할 뿐이에요.	
  The repair cost was high, 수리비가 많이 나왔다	
  전에는 거의 몰랐어요. I hardly knew about it before.	
  관찰하는 능력 Observing ability	
  하루를 마무리해요
  end the day	

    EXAMPLE OUTPUT:

    {
      "cards": [
        {"definition": "under 30 km/h.", "term": "시속 30km 이하"},
        {"definition": "Just doing my best.", "term": "최선을 다할 뿐이에요."},
        {"definition": "Purchased a dishwasher.", "term": "식기세척기를 구매했어요."},
        {"definition": "The repair cost was high", "term": "수리비가 많이 나왔다"},
        {"definition": "I hardly knew about it before.", "term": "전에는 거의 몰랐어요."},
        {"definition": "end the day", "term": "하루를 마무리해요"},
        {"definition": "Observing ability", "term": "관찰하는 능력"}
      ]
    }

  INSTRUCTIONS:
  The user of a Korean flashcard app is attempting to enter
  unstructured learning data into the app. The data format will
  be unpredictable and varied. The output must be uniform.
  
  Your task is to identify the "definition" (Korean) and "term" (English)
  of the data. You will convert these pairs into JSON data.

  You will be penalized for guessing or providing incorrect data.
  You will be rewarded for providing accurate data.
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
  const cards: Card[] = JSON.parse(x.choices[0].message.content || "null")?.cards;
  return cards;
}
