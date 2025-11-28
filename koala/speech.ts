import { Card } from "@prisma/client";
import { template } from "radash";
import { generateSpeechURL } from "./generate-speech-url";
import { removeParens } from "./quiz-evaluators/evaluator-utils";
import { generateDefinitionSpeechURL } from "./generate-definition-speech-url";

type TermAudioParams = {
  card: Pick<Card, "term" | "gender">;
};

const TERM_ONLY = `<speak>{{term}}</speak>`;

export async function generateTermAudio(params: TermAudioParams) {
  const gender =
    (["M", "F", "N"] as const).find((g) => g === params.card.gender) ||
    "N";
  return await generateSpeechURL({
    text: template(TERM_ONLY, {
      term: removeParens(params.card.term),
    }),
    gender,
    langCode: "ko",
  });
}

export async function generateDefinitionAudio(definition: string) {
  return await generateDefinitionSpeechURL(removeParens(definition));
}
