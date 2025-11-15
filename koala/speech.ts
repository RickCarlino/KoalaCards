import { Card } from "@prisma/client";
import { template } from "radash";
import { LessonType } from "./shared-types";
import { generateSpeechURL } from "./generate-speech-url";
import { removeParens } from "./quiz-evaluators/evaluator-utils";

type AudioLessonParams = {
  card: Pick<Card, "term" | "definition" | "gender">;
  lessonType: LessonType | "new";
  speed?: number;
};

const DICTATION = `<speak>
  <prosody rate="{{speed}}%">{{term}}</prosody>
  <break time="0.4s"/>
  <voice language="en-US" gender="female">{{definition}}</voice>
  <break time="0.4s"/>
</speak>`;

const SSML: Record<LessonType, string> = {
  speaking: `<speak><voice language="en-US" gender="female">{{definition}}</voice></speak>`,
  // listening: `<speak><prosody rate="{{speed}}%">{{term}}</prosody></speak>`,
  new: DICTATION,
  remedial: DICTATION,
};

export async function generateLessonAudio(params: AudioLessonParams) {
  return await generateSpeechURL({
    text: template(SSML[params.lessonType], {
      term: removeParens(params.card.term),
      definition: removeParens(params.card.definition),
      speed: params.speed || 100,
    }),
    gender: params.card.gender as "N",
    langCode: "ko",
  });
}
