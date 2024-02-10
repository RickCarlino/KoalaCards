import textToSpeech, { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import fs, { existsSync, readFileSync } from "fs";
import path from "path";
import { draw, template } from "radash";
import util from "util";
import { errorReport } from "./error-report";

type LessonType = "dictation" | "listening" | "speaking";

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
  dictation: `<speak>
  <audio clipBegin="0.2s" clipEnd="0.8s" src="https://actions.google.com/sounds/v1/impacts/glass_drop_and_roll.ogg"></audio><break time="0.08s"/><prosody rate="x-slow">{{term}}</prosody></speak>`,
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

export async function generateLessonAudio(
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

export default async function getLessons(_: GetLessonInputParams) {
  return [];
}
