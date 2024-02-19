import textToSpeech, { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import { existsSync, mkdir, readFileSync, writeFileSync } from "fs";
import path from "path";
import { draw, map, template } from "radash";
import { errorReport } from "./error-report";
import { prismaClient } from "@/server/prisma-client";
import { timeUntil } from "./time-until";

type LessonType = "listening" | "speaking";

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
const SSML: Record<LessonType, string> = {
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
const dir = path.join(DATA_DIR, "speech", "ko");
if (!existsSync(dir)) {
  // Create the speech/ko/ dir if it doesnt exist:
  mkdir(dir, { recursive: true }, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

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
    console.log(txt);
    if (!response.audioContent) {
      return errorReport("No audio content");
    }
    await writeFileSync(p, response.audioContent, "binary");
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

export async function generateLessonAudio(
  lessonType: LessonType,
  term: string,
  definition: string,
  speed: number,
) {
  const ssml = template(SSML[lessonType], { term, definition, speed });
  return generateSpeech(ssml);
}

export default async function getLessons(p: GetLessonInputParams) {
  const yesterday = new Date().getTime() - 24 * 60 * 60 * 1000;

  const quizzes = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: p.userId,
        flagged: false,
      },
      id: {
        notIn: p.notIn,
      },
      firstReview: {
        gt: 0,
      },
      quizType: {
        in: ["listening", "speaking"],
      },
      nextReview: {
        lt: p.now,
      },
      lastReview: {
        lt: yesterday,
      },
    },
    orderBy: {
      nextReview: "asc",
    },
    // Don't select quizzes from the same card.
    // Prevents hinting.
    distinct: ["cardId"],
    take: p.take || 10,
    include: {
      Card: true, // Include related Card data in the result
    },
  });

  return await map(quizzes, async (quiz) => {
    const audio = await generateLessonAudio(
      quiz.quizType as LessonType,
      quiz.Card.term,
      quiz.Card.definition,
      100,
    );
    return {
      quizId: quiz.id,
      definition: quiz.Card.definition,
      term: quiz.Card.term,
      repetitions: quiz.repetitions,
      lapses: quiz.lapses,
      lessonType: quiz.quizType as "listening" | "speaking",
      audio,
    };
  });
}
