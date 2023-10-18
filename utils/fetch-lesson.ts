import { prismaClient } from "@/server/prisma-client";
import textToSpeech, { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import fs, { existsSync, readFileSync } from "fs";
import path from "path";
import { draw } from "radash";
import util from "util";

type LocalQuiz = {
  id: number;
  en: string;
  ko: string;
  repetitions: number;
  lapses: number;
  audio: {
    dictation: string;
    listening: string;
    speaking: string;
  };
};

const DATA_DIR = process.env.DATA_DIR || ".";

let CLIENT: TextToSpeechClient;
const creds = JSON.parse(process.env.GCP_JSON_CREDS || "false");
if (creds) {
  CLIENT = new textToSpeech.TextToSpeechClient({
    projectId: creds.project_id,
    credentials: creds,
  });
} else {
  CLIENT = new textToSpeech.TextToSpeechClient();
}

const VOICES = ["A", "B", "C", "D"].map((x) => `ko-KR-Wavenet-${x}`);
const LESSON_SIZE = 5;

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
  return path.format({
    dir: path.join(DATA_DIR, "speech", langCode),
    name: hash,
    ext: ".mp3",
  });
};

const generateSpeechFile = async (
  txt: string,
  voice: string = randomVoice(),
) => {
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
  return p;
};

/** Create and play a text to speech MP3 via Google Cloud.
 * Stores previously synthesized speech in a cache directory
 * to improve latency. */
async function newSpeak(txt: string, voice: string = randomVoice()) {
  const p = await generateSpeechFile(txt, voice);
  return `data:audio/mpeg;base64,${readFileSync(p, { encoding: "base64" })}`;
}

const ssml = (...text: string[]) => {
  return `<speak>${text.join(" ")}</speak>`;
};

const slow = (text: string) => {
  return `<prosody rate="x-slow">${text}</prosody>`;
};

const en = (text: string) => {
  return `<voice language="en-US" gender="female">${text}</voice>`;
};

type LessonType = "dictation" | "listening" | "speaking";

async function getAudio(lessonType: LessonType, _ko: string, _en: string) {
  let innerSSML: string;
  switch (lessonType) {
    case "dictation":
      innerSSML = slow(_ko);
      break;
    case "listening":
      innerSSML = _ko;
      break;
    case "speaking":
      innerSSML = en(_en);
      break;
  }
  return newSpeak(ssml(innerSSML));
}

type GetLessonInputParams = {
  userId: string;
  /** Current time */
  now?: number;
  /** Max number of cards to return */
  take?: number;
  /** IDs that are already in the user's hand. */
  notIn?: number[];
};

export default async function getLessons(p: GetLessonInputParams) {
  const userId = p.userId;
  const now = p.now || Date.now();
  const take = p.take || LESSON_SIZE;
  const excludedIDs = p.notIn || [];
  // First, pick the card with the most repetitions.
  // If there are multiple cards with the same number of repetitions,
  // pick the one that was last reviewed the longest ago.
  // SELECT * FROM Card WHERE nextReviewAt < NOW
  // ORDER BY repetitions DESC, nextReviewAt DESC;
  const cards = await prismaClient.card.findMany({
    include: { phrase: true },
    where: {
      id: { notIn: excludedIDs },
      flagged: false,
      userId,
      nextReviewAt: {
        lte: now,
      },
    },
    orderBy: [{ repetitions: "desc" }, { nextReviewAt: "asc" }],
    take,
  });
  const output: LocalQuiz[] = [];
  for (const card of cards) {
    const en = card.phrase.definition;
    const ko = card.phrase.term;
    output.push({
      id: card.id,
      en,
      ko,
      repetitions: card.repetitions,
      lapses: card.lapses,
      audio: {
        dictation: await getAudio("dictation", ko, en),
        listening: await getAudio("listening", ko, en),
        speaking: await getAudio("speaking", ko, en),
      },
    });
  }

  return output;
}
