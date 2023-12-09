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
  dictation: `<speak><audio clipBegin="0.2s" clipEnd="0.8s" src="https://actions.google.com/sounds/v1/impacts/glass_drop_and_roll.ogg"></audio><voice language="en-US" rate="115%" gender="female">{{definition}}</voice><break time="0.15s"/><prosody rate="x-slow">{{term}}</prosody></speak>`,
  speaking: `<speak><break time="0.5s"/><voice language="en-US" gender="female">{{definition}}</voice></speak>`,
  listening: `<speak><break time="0.5s"/><prosody rate="{{speed}}%">{{term}}</prosody></speak>`,
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
    take: 300,
  });
  const ids = shuffle(allPossibleIDs.map((x) => x.id)).slice(0, take);
  return prismaClient.card.findMany({
    where: { id: { in: ids } },
  });
};
// Originally, we sorted the cards due via:
// lapses/desc, repetitions/desc, createdAt/asc,
// This turn out to be mentally exhausting because the user
// is forced to review back-to-back difficult cards. Getting
// multiple cards wrong at the start of a lesson is not fun.
// As such, I now use a pseudo-shuffle mechanism so that
// difficult cards are spread out.
function randomSortOrder(): "desc" | "asc" {
  return Math.random() > 0.5 ? "desc" : "asc";
}

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
      { lapses: randomSortOrder() },
      { repetitions: randomSortOrder() },
      { createdAt: randomSortOrder() },
    ],
    take,
  });
};
/** 24 hours in milliseconds */
const ONE_DAY = 24 * 60 * 60 * 1000;

const newCardsLearnedToday = (userId: string, now: number) => {
  return prismaClient.card.count({
    where: {
      userId,
      firstReview: { gt: new Date(now - ONE_DAY) },
    },
  });
};

const applyDefaults = async (p: GetLessonInputParams) => {
  const notIn = p.notIn || [];
  const now = p.now || Date.now();
  const userId = p.userId;
  const settings = await getUserSettings(userId);
  const speed = settings.playbackSpeed * 100;

  const totalToday = await newCardsLearnedToday(userId, now);
  const maxPerDay = settings.cardsPerDayMax;
  const take = p.take || LESSON_SIZE;
  const takeNew = Math.max(Math.min(take, maxPerDay - totalToday), 0);

  return {
    notIn,
    now,
    speed,
    take,
    userId,
    takeNew,
  };
};

export default async function getLessons(p: GetLessonInputParams) {
  const { notIn, now, speed, takeNew, take, userId } = await applyDefaults(p);
  const query = { userId, take, notIn };
  const cards = await getOldCards(now, query);
  const remainingSpace = Math.max(takeNew - cards.length, 0);
  if (remainingSpace > 0) {
    const newCards = await getNewCards({
      ...query,
      take: remainingSpace,
    });
    newCards.forEach((c) => cards.push(c));
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
