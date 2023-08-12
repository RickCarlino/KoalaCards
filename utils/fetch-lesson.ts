import { prismaClient } from "@/server/prisma-client";
import textToSpeech from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import fs, { existsSync, readFileSync } from "fs";
import { draw, shuffle } from "radash";
import util from "util";

const CLIENT = new textToSpeech.TextToSpeechClient();

const VOICES = ["ko-KR-Wavenet-B", "ko-KR-Wavenet-C"];

/** My main focus is Korean, so I randomly pick
 * one of Google's Korean voices if no voice is
 * explicitly provided. */
const randomVoice = () => draw(VOICES) || VOICES[0];

/** Generates a file path for where to store the MP3
 * file. The path is combination of the language code
 * and an MD5 hash of the card being synthesized. */
const filePathFor = (text: string, voice: string) => {
  const hash = createHash("md5").update(text).digest("hex");
  const langCode = voice.split("-")[0];
  return `speech/${langCode}/${hash}.mp3`;
};

/** Create and play a text to speech MP3 via Google Cloud.
 * Stores previously synthesized speech in a cache directory
 * to improve latency. */
async function newSpeak(txt: string, voice: string = randomVoice()) {
  const p = filePathFor(txt, voice);
  if (!existsSync(p)) {
    const [response] = await CLIENT.synthesizeSpeech({
      input: { ssml: txt },
      voice: {
        languageCode: "ko",
        name: voice,
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    });

    if (!response.audioContent) {
      throw new Error("No audio content");
    }
    const writeFile = util.promisify(fs.writeFile);
    await writeFile(p, response.audioContent, "binary");
  }
  return `data:audio/mpeg;base64,${readFileSync(p, { encoding: "base64" })}`;
}

const ssml = (...text: string[]) => {
  return `<speak>${text.join(" ")}</speak>`;
};

const slow = (text: string) => {
  return `<prosody rate="slow">${text}</prosody>`;
};

const en = (text: string) => {
  return `<voice language="en-US" gender="female">${text}</voice>`;
};

const ko = (text: string) => {
  return text;
};

const pause = (ms: number) => {
  return `<break time="${ms}ms"/>`;
};

type QuizType = "dictation" | "listening" | "speaking";

export const QUIZ_TYPES: QuizType[] = ["dictation", "listening", "speaking"];

async function getAudio(quizType: QuizType, _ko: string, _en: string) {
  let innerSSML: string;
  switch (quizType) {
    case "dictation":
      innerSSML = [
        en("Repeat: "),
        pause(250),
        ko(_ko),
        pause(250),
        slow(_ko),
      ].join(" ");
      break;
    case "listening":
      innerSSML = [en("Say in English: "), pause(250), ko(_ko)].join(" ");
      break;
    case "speaking":
      innerSSML = [en("In Korean: "), pause(250), en(_en)].join(" ");
      break;
  }
  return newSpeak(ssml(innerSSML));
}

interface Quiz {
  id: number;
  en: string;
  ko: string;
  quizType: QuizType;
  quizAudio: string;
}
export default async function getLessons(userId: string): Promise<Quiz[]> {
  const cards = await prismaClient.card.findMany({
    include: { phrase: true },
    where: { flagged: false, userId },
    orderBy: [{ nextReviewAt: "asc" }, { repetitions: "asc" }],
    take: 10,
  });
  const DICT = "dictation" as const;
  const LIST = "listening" as const;
  const SPEAK = "speaking" as const;
  const quizzes: Quiz[] = [];
  cards.map(async (card) => {
    if (card.repetitions > 3) {
      return;
    }
    const ko = card.phrase.term;
    const en = card.phrase.definition;
    const quizAudio = await getAudio("dictation", ko, en);
    quizzes.push({
      id: card.id,
      en,
      ko,
      quizType: DICT,
      quizAudio,
    });
  });
  cards.map(async (card) => {
    shuffle([LIST, SPEAK]).map(async (quizType) => {
      const ko = card.phrase.term;
      const en = card.phrase.definition;
      const quizAudio = await getAudio(quizType, ko, en);
      quizzes.push({
        id: card.id,
        en,
        ko,
        quizType,
        quizAudio,
      });
    });
  });
  return quizzes;
}
