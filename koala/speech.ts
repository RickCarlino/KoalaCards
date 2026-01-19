import { Card } from "@prisma/client";
import { template } from "radash";
import { generateSpeechURL } from "./generate-speech-url";
import { removeParens } from "./quiz-evaluators/evaluator-utils";
import {
  generateDefinitionSpeechURL,
  generateOpenAISpeechURL,
} from "./generate-definition-speech-url";

type TermAudioParams = {
  card: Pick<Card, "term" | "gender">;
};

const TERM_ONLY = `<speak>{{term}}</speak>`;
const USE_OPENAI_AUDIO = true;

export async function generateTermAudio(params: TermAudioParams) {
  const cleanTerm = removeParens(params.card.term);
  if (USE_OPENAI_AUDIO) {
    return await generateOpenAISpeechURL({
      text: cleanTerm,
      filePrefix: "lesson-audio",
    });
  }
  const gender =
    (["M", "F", "N"] as const).find((g) => g === params.card.gender) ||
    "N";
  return await generateSpeechURL({
    text: template(TERM_ONLY, {
      term: cleanTerm,
    }),
    gender,
    langCode: "ko",
  });
}

export async function generateDefinitionAudio(definition: string) {
  const cleanDefinition = removeParens(definition);
  if (USE_OPENAI_AUDIO) {
    return await generateOpenAISpeechURL({
      text: cleanDefinition,
      filePrefix: "lesson-definition-audio",
    });
  }
  return await generateDefinitionSpeechURL(cleanDefinition);
}
