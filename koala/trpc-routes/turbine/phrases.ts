import { zodResponseFormat } from "openai/helpers/zod";
import { cluster, shuffle } from "radash";
import { ColocationGroup } from "./colocations";
import { openai } from "@/koala/openai";
import { z } from "zod";

const PHRASE_GENERATION_PROMPT = `
You are a specialized AI phrase generator inside of a language learning app.
You make short, grammatically correct, realistic phrases by combining colocations.
For each item in the list:

1. Look at the colocation pair.
2. Combine the colocations to produce a short, grammatically correct, realistic verb phrase, noun phrase, or adjective phrase.
3. If (and only if!) the phrase is a verb phrase, conjugate using the provided conjugation style.
4. Double check your work to make sure the phrase is grammatically correct and realistic.

Keep in mind:
 * This is being used for language education, so the correctness and realism of the phrases is very important.
 * The words are provided in "dictionary form" but you encouraged to make changes by adding particles, conjugations and verb endings.
`;

const PhraseSchema = z.object({
  phrases: z.array(z.string()),
});

const CLICHE = ["계획하다", "느끼다", "상황", "계획", "행동", "분위기", "하다", "경험"];
export async function generatePhrases(colocations: ColocationGroup[]) {
  if (colocations.length < 1) {
    return [];
  }
  type Pair = [string, string];
  const pairs: Pair[] = colocations
    .map((item): Pair[] => {
      const base: Pair[] = [
        [item.target, item.noun],
        [item.target, item.adjective],
        [item.target, item.verb],
      ];
      const wut = base
        .filter(([a, b]) => !(a.endsWith("다") && b.endsWith("다")))
        .filter(([a, b]) => !CLICHE.includes(a) && !CLICHE.includes(b));
      console.log(wut.join("\n"));
      return wut;
    })
    .flat();

  const conjugations = shuffle([
    "polite informal past (ex: 했어요)",
    "polite informal past (ex: 했어요)",
    "polite informal past (ex: 했어요)",
    "polite informal present (ex: 해요)",
    "polite informal present (ex: 해요)",
    "polite informal present (ex: 해요)",
    "polite formal present (ex: 합니다)",
    "polite formal past (ex: 했습니다)",
    "plain present (ex: 한다)",
    "casual present (ex: 해)",
    "casual present (ex: 해)",
    "casual past (ex: 했어)",
    "casual past (ex: 했어)",
  ]);

  const all = pairs.map((pair, index) => {
    const conjugation = conjugations[index % conjugations.length];
    return `${pair[0]} + ${pair[1]} => ${conjugation}`;
  });

  const clusters = cluster(shuffle(all), Math.round(all.length + 1 / 3) + 1);
  const words = await Promise.all(
    clusters.map(async (cluster) => {
      const content = cluster
        .map((item, index) => `${index + 1}. ${item}`)
        .join("\n");
      const response = await openai.beta.chat.completions.parse({
        messages: [
          { role: "system", content: PHRASE_GENERATION_PROMPT },
          { role: "user", content },
        ],
        model: "o3-mini",
        reasoning_effort: "low",
        response_format: zodResponseFormat(PhraseSchema, "phrases"),
      });

      const parsedResponse = response.choices[0]?.message?.parsed;
      if (!parsedResponse) {
        throw new Error("Invalid response format from OpenAI.");
      }
      return parsedResponse.phrases;
    }),
  );
  return words.flat();
}
