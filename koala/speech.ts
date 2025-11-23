import { Card } from "@prisma/client";
import { template } from "radash";
import { generateSpeechURL } from "./generate-speech-url";
import { removeParens } from "./quiz-evaluators/evaluator-utils";
import { generateDefinitionSpeechURL } from "./generate-definition-speech-url";

type TermAudioParams = {
  card: Pick<Card, "term" | "gender">;
  speed?: number;
};

const TERM_ONLY = `<speak><prosody rate="{{speed}}%">{{term}}</prosody></speak>`;
const MIN_SPEAKING_RATE = 0.25;
const MAX_SPEAKING_RATE = 4;

export async function generateTermAudio(params: TermAudioParams) {
  const speedPct = params.speed ?? 100;
  const gender =
    (["M", "F", "N"] as const).find((g) => g === params.card.gender) ||
    "N";
  const speakingRate = Math.min(
    MAX_SPEAKING_RATE,
    Math.max(MIN_SPEAKING_RATE, speedPct / 100),
  );
  return await generateSpeechURL({
    text: template(TERM_ONLY, {
      term: removeParens(params.card.term),
      speed: speedPct,
    }),
    gender,
    langCode: "ko",
    speed: speakingRate,
  });
}

export async function generateDefinitionAudio(definition: string) {
  return await generateDefinitionSpeechURL(removeParens(definition));
}
