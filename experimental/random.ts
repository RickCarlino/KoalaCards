import "../src/utils/env";
import { draw, shuffle, zip } from "radash";
import { ask } from "../src/utils/ask";
import { koreanGrammar } from "./korean-grammar";
import { scenarios } from "./scenarios";

const PROMPT = `
I am a Korean language student.
I am going to give you:
1. A Korean grammar pattern
2. A list of 5 themes or scenarios

Create 5 example sentences uses the themes in item 2.
Sentences must be under 23 characters in length.
Sentences must be polite and conversational.
Sentences should represent speech that would happen in the given scenario.

Return JSON in the format of:
[{"ko": "...", "en": "..."}, ...]

`;

(async () => {
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
  console.log(JSON.parse(r));
})();
