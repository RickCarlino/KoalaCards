import { prismaClient } from "@/server/prisma-client";
import textToSpeech, { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import fs, { existsSync, readFileSync } from "fs";
import path from "path";
import { draw, template } from "radash";
import util from "util";

type LocalQuiz = {
  id: number;
  definition: string;
  term: string;
  repetitions: number;
  lapses: number;
  audio: {
    dictation: string;
    listening: string;
    speaking: string;
  };
};

type LessonType = keyof LocalQuiz["audio"];

type GetLessonInputParams = {
  userId: string;
  /** Current time */
  now?: number;
  /** Max number of cards to return */
  take?: number;
  /** IDs that are already in the user's hand. */
  notIn?: number[];
};

const DATA_DIR = process.env.DATA_DIR || ".";
const VOICES = ["A", "B", "C", "D"].map((x) => `ko-KR-Wavenet-${x}`);
const LESSON_SIZE = 5;
const SSML: Record<LessonType, string> = {
  dictation: `<speak><prosody rate="x-slow">{{term}}</prosody></speak>`,
  speaking: `<speak><voice language="en-US" gender="female">{{definition}}</voice></speak>`,
  listening: `<speak>{{term}}</speak>`,
};

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
async function generateSpeech(txt: string, voice: string = randomVoice()) {
  const p = await generateSpeechFile(txt, voice);
  return `data:audio/mpeg;base64,${readFileSync(p, { encoding: "base64" })}`;
}

async function generateLessonAudio(
  lessonType: LessonType,
  _term: string,
  _definition: string,
) {
  const ssml = template(SSML[lessonType], {
    term: _term,
    definition: _definition,
  });
  return generateSpeech(ssml);
}

export default async function getLessons(p: GetLessonInputParams) {
  const userId = p.userId;
  const now = p.now || Date.now();
  const take = p.take || LESSON_SIZE;
  const excludedIDs = p.notIn || [];
  const cards = await prismaClient.card.findMany({
    where: {
      id: { notIn: excludedIDs },
      flagged: false,
      userId,
      nextReviewAt: { lt: now },
    },
    orderBy: [
      { lapses: "desc" },
      { repetitions: "desc" },
      { createdAt: "asc" },
    ],
    take,
  });
  const output: LocalQuiz[] = [];
  for (const card of cards) {
    const { term, definition } = card;
    output.push({
      id: card.id,
      definition,
      term,
      repetitions: card.repetitions,
      lapses: card.lapses,
      audio: {
        dictation: await generateLessonAudio("dictation", term, definition),
        listening: await generateLessonAudio("listening", term, definition),
        speaking: await generateLessonAudio("speaking", term, definition),
      },
    });
  }

  return output;
}
