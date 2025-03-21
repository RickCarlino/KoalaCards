import { Card } from "@prisma/client";
import { template } from "radash";
import { LessonType } from "./shared-types";
import { generateSpeechURL } from "./generate-speech-url";
import { removeParens } from "./quiz-evaluators/evaluator-utils";

type AudioLessonParams = {
  card: Pick<Card, "term" | "definition" | "gender" | "langCode">;
  lessonType: LessonType | "dictation";
  speed?: number;
};

const DICTATION = `{{term}} {{definition}}`;
const SSML: Record<LessonType, string> = {
  speaking: `{{definition}}`,
  listening: `{{term}}`,
  dictation: DICTATION,
  review: DICTATION,
};

export async function generateLessonAudio(params: AudioLessonParams) {
  return await generateSpeechURL({
    text: template(SSML[params.lessonType], {
      term: removeParens(params.card.term),
      definition: removeParens(params.card.definition),
      speed: params.speed || 100,
    }),
    gender: params.card.gender as "N",
    langCode: params.card.langCode,
  });
}
