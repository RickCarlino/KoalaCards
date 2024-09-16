import { Card } from "@prisma/client";
import { template } from "radash";
import { LessonType } from "./shared-types";
import { generateSpeechURL } from "./generate-speech-url";

type AudioLessonParams = {
  card: Card;
  lessonType: LessonType | "dictation";
  speed?: number;
};

const SSML: Record<LessonType, string> = {
  speaking: `<speak><voice language="en-US" gender="female">{{definition}}</voice></speak>`,
  listening: `<speak><prosody rate="{{speed}}%">{{term}}</prosody></speak>`,
  dictation: `<speak><prosody rate="{{speed}}%">{{term}}</prosody><break time="0.4s"/><voice language="en-US" gender="female">{{definition}}</voice><break time="0.4s"/></speak>`,
};

export async function generateLessonAudio(params: AudioLessonParams) {
  return await generateSpeechURL({
    text: template(SSML[params.lessonType], {
      term: params.card.term,
      definition: params.card.definition,
      speed: params.speed || 100,
    }),
    gender: params.card.gender as "N",
    langCode: params.card.langCode,
  });
}
