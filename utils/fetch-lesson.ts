import { getUserSettings } from "@/server/auth-helpers";
import { prismaClient } from "@/server/prisma-client";
import textToSpeech, { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import fs, { existsSync, readFileSync } from "fs";
import path from "path";
import { draw, shuffle, template } from "radash";
import util from "util";
import { errorReport } from "./error-report";

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
  dictation: `<speak>
    <voice language="en-US" gender="female">{{definition}}</voice>
    <break time="0.3s"/>
    <prosody rate="x-slow">{{term}}</prosody>
  </speak>`,
  speaking: `<speak><voice language="en-US" gender="female">{{definition}}</voice></speak>`,
  listening: `<speak><prosody rate="{{speed}}%">{{term}}</prosody></speak>`,
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
      return errorReport("No audio content");
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
  speed: number,
) {
  const ssml = template(SSML[lessonType], {
    term: _term,
    definition: _definition,
    speed,
  });
  return generateSpeech(ssml);
}
type GetCardsParams = {
  userId: string;
  take: number;
  notIn: number[];
};
const getNewCards = async ({ userId, take, notIn }: GetCardsParams) => {
  // Shuffle the most recently created 100 cards
  const allPossibleIDs = await prismaClient.card.findMany({
    where: {
      id: { notIn },
      flagged: false,
      userId,
      AND: [{ lapses: 0 }, { repetitions: 0 }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
    },
    take: 100,
  });
  const ids = shuffle(allPossibleIDs.map((x) => x.id)).slice(0, take);
  return prismaClient.card.findMany({
    where: { id: { in: ids } },
  });
};

const getOldCards = (now: number, { userId, take, notIn }: GetCardsParams) => {
  return prismaClient.card.findMany({
    where: {
      id: { notIn },
      flagged: false,
      userId,
      nextReviewAt: { lt: now },
      OR: [{ lapses: { gt: 0 } }, { repetitions: { gt: 0 } }],
    },
    orderBy: [
      { lapses: "desc" },
      { repetitions: "desc" },
      { createdAt: "asc" },
    ],
    take,
  });
};
/** 24 hours in milliseconds */
const ALMOST_A_DAY = 23 * 60 * 60 * 1000;

const newCardsLearnedToday = (userId: string, now: number) => {
  return prismaClient.card.count({
    where: {
      userId,
      firstReview: { gt: new Date(now - ALMOST_A_DAY) },
    },
  });
};

export default async function getLessons(p: GetLessonInputParams) {
  const userId = p.userId;
  const now = p.now || Date.now();
  const take = p.take || LESSON_SIZE;
  const excludedIDs = p.notIn || [];
  const params = { userId, take, notIn: excludedIDs };
  const cards = await getOldCards(now, params);
  const cardsLeft = take - cards.length;
  const speed = (await getUserSettings(userId)).playbackSpeed * 100;
  if (cardsLeft > 0) {
    const dailyIntake = await newCardsLearnedToday(userId, now);
    const maxPerDay = (await getUserSettings(userId)).cardsPerDayMax;
    if (dailyIntake < maxPerDay) {
      const newCards = await getNewCards(params);
      newCards.forEach((c) => cards.push(c));
    }
  }
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
        dictation: await generateLessonAudio(
          "dictation",
          term,
          definition,
          speed,
        ),
        listening: await generateLessonAudio(
          "listening",
          term,
          definition,
          speed,
        ),
        speaking: await generateLessonAudio(
          "speaking",
          term,
          definition,
          speed,
        ),
      },
    });
  }

  return output;
}
