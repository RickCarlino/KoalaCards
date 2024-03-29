import textToSpeech, { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import { existsSync, mkdir, readFileSync, writeFileSync } from "fs";
import path from "path";
import { draw, map, template, unique } from "radash";
import { errorReport } from "./error-report";
import { prismaClient } from "@/koala/prisma-client";
import { Card } from "@prisma/client";
import { getUserSettings } from "./auth-helpers";

export type LessonType = "listening" | "speaking";

type GetLessonInputParams = {
  userId: string;
  /** Current time */
  now: number;
  /** Max number of cards to return */
  take: number;
  /** IDs that are already in the user's hand. */
  notIn: number[];
};

type Gender = "F" | "M" | "N";
type LangCode = "ko" | "es" | "it" | "fr";

type LangLookTable = Record<LangCode, Record<Gender, string[]>>;

const Voices: LangLookTable = {
  ko: {
    F: [
      "ko-KR-Wavenet-A",
      "ko-KR-Wavenet-B",
      "ko-KR-Wavenet-C",
      "ko-KR-Wavenet-D",
    ],
    M: [
      "ko-KR-Wavenet-A",
      "ko-KR-Wavenet-B",
      "ko-KR-Wavenet-C",
      "ko-KR-Wavenet-D",
    ],
    N: [
      "ko-KR-Wavenet-A",
      "ko-KR-Wavenet-B",
      "ko-KR-Wavenet-C",
      "ko-KR-Wavenet-D",
    ],
  },
  es: {
    F: ["es-ES-Wavenet-C", "es-ES-Wavenet-D"],
    M: ["es-ES-Wavenet-B"],
    N: ["es-ES-Wavenet-B", "es-ES-Wavenet-C", "es-ES-Wavenet-D"],
  },
  it: {
    F: ["it-IT-Wavenet-A", "it-IT-Wavenet-B"],
    M: ["it-IT-Wavenet-C", "it-IT-Wavenet-D"],
    N: [
      "it-IT-Wavenet-A",
      "it-IT-Wavenet-B",
      "it-IT-Wavenet-C",
      "it-IT-Wavenet-D",
    ],
  },
  fr: {
    F: ["fr-FR-Wavenet-A", "fr-FR-Wavenet-C"],
    M: ["fr-FR-Wavenet-B", "fr-FR-Wavenet-D"],
    N: [
      "fr-FR-Wavenet-A",
      "fr-FR-Wavenet-B",
      "fr-FR-Wavenet-C",
      "fr-FR-Wavenet-D",
    ],
  },
};

const DATA_DIR = process.env.DATA_DIR || ".";
const SSML: Record<LessonType | "playback", string> = {
  speaking: `<speak><break time="0.5s"/><voice language="en-US" gender="female">{{definition}}</voice></speak>`,
  listening: `<speak><break time="0.5s"/><prosody rate="{{speed}}%">{{term}}</prosody></speak>`,
  playback: `<speak><break time="0.4s"/><prosody rate="{{speed}}%">{{term}}</prosody><break time="0.4s"/><voice language="en-US" gender="female">{{definition}}</voice></speak>`,
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
const randomVoice = (langCode: string, gender: string) => {
  const l1 = Voices[langCode as LangCode] || Voices.ko;
  const l2 = l1[gender as Gender] || l1.N;
  return draw(l2) || l2[0];
};

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
["ko", "es", "it", "fr"].forEach((langCode) => {
  const dir = path.join(DATA_DIR, "speech", langCode);
  if (!existsSync(dir)) {
    // Create the speech/lang dir if it doesnt exist:
    mkdir(dir, { recursive: true }, (err) => {
      err && console.error(err);
    });
  }
});

const generateSpeechFile = async (txt: string, voice: string) => {
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
    await writeFileSync(p, response.audioContent, "binary");
  }
  return p;
};

/** Create and play a text to speech MP3 via Google Cloud.
 * Stores previously synthesized speech in a cache directory
 * to improve latency. */
async function generateSpeech(txt: string, voice: string) {
  const p = await generateSpeechFile(txt, voice);
  return `data:audio/mpeg;base64,${readFileSync(p, { encoding: "base64" })}`;
}

type AudioLessonParams = {
  card: Card;
  lessonType: LessonType | "playback";
  speed?: number;
};

export async function generateLessonAudio(params: AudioLessonParams) {
  const tpl = SSML[params.lessonType];
  const ssml = template(tpl, {
    term: params.card.term,
    definition: params.card.definition,
    speed: params.speed || 100,
  });
  const voice = randomVoice(params.card.langCode, params.card.gender);
  return generateSpeech(ssml, voice);
}

async function getExcludedIDs(wantToExclude: number[]) {
  if (!wantToExclude.length) return Promise.resolve([]);
  const quizzes = prismaClient.quiz;

  return (
    await quizzes.findMany({
      where: {
        cardId: {
          in: (
            await quizzes.findMany({
              where: {
                id: { in: wantToExclude },
              },
              select: { cardId: true },
            })
          ).map(({ cardId }) => cardId),
        },
      },
      select: { id: true },
    })
  ).map(({ id }) => id);
}

const newQuizzesInLast24Hours = async (userId: string) => {
  const yesterday = new Date().getTime() - 24 * 60 * 60 * 1000;
  return prismaClient.quiz.count({
    where: {
      Card: {
        userId,
        flagged: false,
      },
      firstReview: {
        gt: yesterday,
      },
    },
  });
};

const newQuizzesAllowedToday = async (userId: string) => {
  const actual = await newQuizzesInLast24Hours(userId);
  const allowed = (await getUserSettings(userId)).cardsPerDayMax || 60;
  return Math.max(allowed - actual, 0);
};

type QuizLike = {
  firstReview: number;
  quizType: string;
  cardId: number;
};
type MFNC = <T extends QuizLike>(
  quizzes: T[],
  userId: string,
  take: number,
) => Promise<T[]>;

const forceListeningBeforeSpeaking: MFNC = async (rawQuizzes, _, take) => {
  // Create a new array.
  // Check each quiz.
  // If it's a speaking quiz, make sure the user has done at least
  // two repetitions of the listening quiz with the matching card, assuming
  // the card *has* a listening quiz.
  const quizzes: typeof rawQuizzes = [];
  console.group("== forceListeningBeforeSpeaking ==");
  for (const quiz of rawQuizzes) {
    if (quizzes.length >= take) {
      console.log("== Reached take limit. Breaking. ==");
      break;
    }
    if (quiz.quizType !== "speaking") {
      // We only care about listening quizzes.
      console.log(`== ${quiz.cardId} is not a speaking quiz. Adding. ==`);
      quizzes.push(quiz);
      continue;
    }

    const siblings = await prismaClient.quiz.findMany({
      where: {
        cardId: quiz.cardId,
        quizType: {
          notIn: ["speaking"],
        },
      },
    });

    if (!siblings.length) {
      // No listening quiz for this card.
      console.log(`== ${quiz.cardId} has no listening quiz. Adding. ==`);
      quizzes.push(quiz);
      continue;
    }

    // Find highest repetition count among siblings:
    const maxReps = Math.max(...siblings.map((s) => s.repetitions - s.lapses));
    if (maxReps > 2) {
      console.log(
        `== ${quiz.cardId} has ${maxReps} net listening reps. Adding. ==`,
      );
      quizzes.push(quiz);
      continue;
    }

    console.log(
      `== ${quiz.cardId} only has ${maxReps} listening reps. Skipping. ==`,
    );
  }
  console.groupEnd();
  return quizzes.slice(0, take);
};

const maybeFilterNewCards: MFNC = async (rawQuizzes, userId, take) => {
  let allowed = await newQuizzesAllowedToday(userId);
  const quizzes = await forceListeningBeforeSpeaking(rawQuizzes, userId, take);
  const output: typeof rawQuizzes = [];
  for (const quiz of quizzes) {
    if (quiz.firstReview) {
      // We don't care about old cards
      output.push(quiz);
    } else {
      if (allowed) {
        output.push(quiz);
        allowed--; // Reduce card limit by one.
      }
    }
  }
  return output;
};

export default async function getLessons(p: GetLessonInputParams) {
  if (p.take > 30) {
    return errorReport("Too many cards requested.");
  }
  const yesterday = new Date().getTime() - 24 * 60 * 60 * 1000;
  const excluded = await getExcludedIDs(p.notIn);
  // SELECT * from public."Quiz" order by "nextReview" desc, "cardId" desc, "quizType" asc;
  const quizzes = await prismaClient.quiz.findMany({
    where: {
      Card: {
        userId: p.userId,
        flagged: { not: true },
      },
      ...(excluded.length ? { id: { notIn: excluded } } : {}),
      quizType: {
        in: ["listening", "speaking"],
      },
      nextReview: {
        lt: p.now || Date.now(),
      },
      lastReview: {
        lt: yesterday,
      },
      // EXPERIMENT: Auto-ignore overly difficult cards.
      difficulty: {
        lt: 9,
      },
    },
    orderBy: [{ Card: { langCode: "desc" } }, { nextReview: "desc" }],
    // Don't select quizzes from the same card.
    // Prevents hinting.
    distinct: ["cardId"],
    take: 300, // Will be filtered to correct length later.
    include: {
      Card: true, // Include related Card data in the result
    },
  });

  const raw = await maybeFilterNewCards(quizzes, p.userId, p.take);
  const filtered = unique(
    unique(raw, (q) => q.cardId),
    (q) => q.id,
  );
  return await map(filtered, async (quiz) => {
    const audio = await generateLessonAudio({
      card: quiz.Card,
      lessonType: quiz.quizType as LessonType,
      speed: 100,
    });
    return {
      quizId: quiz.id,
      cardId: quiz.cardId,
      definition: quiz.Card.definition,
      term: quiz.Card.term,
      repetitions: quiz.repetitions,
      lapses: quiz.lapses,
      lessonType: quiz.quizType as "listening" | "speaking",
      audio,
      langCode: quiz.Card.langCode,
      lastReview: quiz.lastReview || 0,
    };
  });
}
