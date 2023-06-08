import { draw, shuffle } from "radash";
import { koreanGrammar } from "./korean-grammar";
import { scenarios } from "./scenarios";
import { ask } from "@/server/routers/main";

const PROMPT = `
Provide 3 short, conversation-focused Korean sentences
using the grammar pattern '-(으)면서' and the mandatory vocabulary
word '공부하다' for everyday situations. Each sentence should
be no more than 12 syllables long.

Provide the response in the following JSON format:

{"ko": "한국어 문장", "en": "English sentence"}
`;
type KoEn = {
  ko: string;
  en: string;
};
type RandomExample = Partial<KoEn>;

export async function createRandomGrammar() {
  console.log("=== THIS IS NOT COMPLETE. The prompt works but code is broke.");
  const grammars = draw(shuffle(Object.entries(koreanGrammar)));
  const scenario = shuffle(scenarios).slice(0, 5);

  if (!grammars || !scenario) {
    throw new Error("Could not draw from grammars or scenarios");
  }
  const temperature = 0.4;
  const prompt2 = `
  1. ${grammars[0]}: ${grammars[1]}
  2. ${scenario.join(", ")}
  `;
  const p = PROMPT + prompt2;
  console.log(p);
  const [r] = await ask(p, { temperature });
  return JSON.parse(r)
    .map((x: RandomExample) => {
      return {
        ko: x.ko,
        en: x.en,
      };
    })
    .filter((k: RandomExample) => {
      return k.ko && k.en;
    }) as KoEn[];
}
