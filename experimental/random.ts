import "../src/utils/env";
import { draw, shuffle, zip } from "radash";
import { koreanWords } from "./korean-words";
import { ask } from "../src/utils/ask";
import { koreanGrammar } from "./korean-grammar";

const PROMPT = `
Given a vocab word and a grammar pattern,
create a short, realistic example sentence for a Korean student.
Use polite 해요체 speech.
Output is a JSON string.
Sentences must be shorter than 21 characters.

1) ["오늘날", "게 하다 / 시키다 / 만들다"] => "오늘날 3D 인쇄를 해보는 게 어때요?"
2) ["좋아하다", "게 하다 / 시키다 / 만들다"] => "좋아하시는 게 어떤 게 있나요?"
3) [ '기르다', '기 때문에: because' ] => "강아지 기르기 때문에 집에 항상 있어요"
4) 
`;

const PROMPT2 = `
Take the following sentences and change the words so that they are
more "realisitic" and also natural. Also fix any grammar and spelling mistakes.
Finally, translate them into English.
Provide the output as JSON: [{"ko": "...", "en": "..."}, ...]

`;
const grammars = shuffle(koreanGrammar);
const vocabs = shuffle(koreanWords);

(async () => {
  const results: string[] = [];
  for (const [vocab, grammar] of zip(vocabs, grammars)) {
    const input = [draw(vocabs), draw(grammars)];
    const temperature = 0.0;
    const p = PROMPT + `${JSON.stringify(input, null, 2)} => \n`;
    const [r] = await ask(p, { temperature });
    const json = JSON.parse(r?.content || "null");
    if (typeof json === "string" && json.length < 23) {
      console.log("OK");
      console.log(json);
      results.push(json);
    } else {
      console.log(json);
    }
    if (results.length > 5) {
      break;
    }
  }
  const p = PROMPT2 + results.map((s,i) => `${i}) ${s}`).join("\n");
  console.log(p);
  const [transformed] = await ask(p, {
    temperature: 0.8,
  });
  console.log(transformed?.content);
})();
