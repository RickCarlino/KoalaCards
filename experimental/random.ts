import { draw, shuffle } from "radash";
import { koreanGrammar } from "./korean-grammar";
import { koreanWords } from "./korean-words";
import { ask } from "@/server/routers/main";

const BASE_CRITERIA = `
* The sentence must strictly contain no more than 12 syllables. This is a crucial requirement.
* While the sentence needs to be short, it should not be overly simplistic.
* The sentence must be formulated in the polite 해요체 form (-요 sentence ending).
* Use only spoken (non-written) Korean.
`;

const VOCAB = `
Generate a Korean example sentence using the provided vocabulary word with the following constraints:
* Include varied grammatical patterns common in the TOPIK II exam.
${BASE_CRITERIA}
Please check the sentence against the criteria above to ensure it complies with all the requirements.
`;

const GRAMMAR = `
Generate a Korean example sentence using the provided grammar pattern under these conditions:
* The sentence should use varied vocab words found in the TOPIK II exam.
${BASE_CRITERIA}
Ensure your sentence complies with all these requirements before finalizing it.
`;

const OPTS = {
  model: "gpt-4",
  temperature: 1,
  best_of: 3,
};

export async function randomNewPhrase() {
  try {
    const fn = draw(shuffle([createRandomGrammar, createRandomVocab]));
    return fn && (await fn());
  } catch (error) {
    console.warn("PHRASE ERROR: " + JSON.stringify(error, null, 2));
    return null;
  }
}

async function createRandomVocab() {
  const vocab = draw(shuffle(koreanWords));

  if (!vocab) {
    throw new Error("Could not draw from grammars or scenarios");
  }
  const prompt = `The vocabulary word is: ${vocab}` + VOCAB;
  const [ko_draft] = await ask(prompt, OPTS);
  return postProcess(ko_draft);
}

async function createRandomGrammar() {
  const [grammar, def] = draw(shuffle(Object.entries(koreanGrammar))) || [
    "",
    "",
  ];

  if (!grammar || !def) {
    throw new Error("Could not draw from grammars or scenarios");
  }
  const footer = `The grammar pattern is: ${grammar} (${def})`;
  const prompt = GRAMMAR + footer;
  const [ko_draft] = await ask(prompt, OPTS);
  return postProcess(ko_draft);
}

async function postProcess(sentence: string) {
  if (syllables(sentence) > 12) {
    return;
  }

  const header = `
  I am performing post-processing of a sentence in a Korean language learning app.
  Some sentences are free of errors, while other sentences need some editing.

  Please perform the following post-processing tasks on the sentence below:
  * If there are two sentences, only return the last sentence and nothing else.
  * Remove notes or explanations.
  * Remove anything in parenthesis or brackets.
  * Remove romanization.
  * Remove English.
  * Remove translations.
  * Remove quotation marks.

  I only want a Korean sentence and nothing else.
  ===

  `;
  const [ko] = await ask(header + sentence);
  const prompt2 = `
  A Korean language learner is studying grammar and vocab for the TOPIK II exam.
  The sentence above will appear in the app and need an English translation.
  It is critical that you ONLY provide a translation and nothing else,
  since your response will be played over text-to-speech in the app.

  Return exactly one English translation of this sentence and nothing else.
  `;
  const [en] = await ask(`The sentence is: ${ko}` + prompt2, OPTS);
  const prompt3 = `
  ${JSON.stringify({ ko, en }, null, 2)}

  Is the Korean example sentence above correct?

  Reply "YES" if all conditions are met:
   * The sentence is grammatically correct.
   * The sentence is natural and sounds like something a native speaker would say.
   * The translation is accurate and natural.

  Reply "NO" if any of the above conditions are not met and EXPLAIN WHY.
  (yes/no):
  `;

  const [yesNo] = await ask(prompt3);
  if (yesNo.slice(0, 3).toUpperCase() === "YES") {
    return { ko, en };
  } else {
    console.log(yesNo + JSON.stringify({ ko, en }, null, 2));
  }
}

function syllables(sentence: string): number {
  // Regular expression to match Korean syllables
  const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g;

  // Get an array of all Korean syllables in the sentence
  const koreanSyllables = sentence.match(koreanRegex);

  // Return the count of Korean syllables
  return koreanSyllables ? koreanSyllables.length : 0;
}
