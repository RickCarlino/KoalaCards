import textToSpeech from "@google-cloud/text-to-speech";
import { execSync } from "child_process";
import { createHash } from "crypto";
import fs, { existsSync, readFileSync } from "fs";
import { draw } from "radash";
import util from "util";

const CLIENT = new textToSpeech.TextToSpeechClient();

const VOICES = ["ko-KR-Wavenet-B", "ko-KR-Wavenet-C"];

/** My main focus is Korean, so I randomly pick
 * one of Google's Korean voices if no voice is
 * explicitly provided. */
const randomVoice = () => draw(VOICES) || VOICES[0];

/** Generates a file path for where to store the MP3
 * file. The path is combination of the language code
 * and an MD5 hash of the phrase being synthesized. */
const filePathFor = (text: string, voice: string) => {
  const hash = createHash("md5").update(text).digest("hex");
  const langCode = voice.split("-")[0];
  return `speech/${langCode}/${hash}.mp3`;
};

export function play(fname: string) {
  execSync(`play -q ${fname} -t alsa`);
}

/** Create and play a text to speech MP3 via Google Cloud.
 * Stores previously synthesized speech in a cache directory
 * to improve latency. */
export async function speak(txt: string, voice: string = randomVoice()) {
  const p = filePathFor(txt, voice);

  if (!existsSync(p)) {
    console.log("=== CACHED VERSION");
    const [response] = await CLIENT.synthesizeSpeech({
      input: { ssml: txt },
      voice: {
        languageCode: "ko-kr",
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
  } else {
    console.log("=== NON-CACHED VERSION");
  }
  play(p);
  return p;
}

/** Create and play a text to speech MP3 via Google Cloud.
 * Stores previously synthesized speech in a cache directory
 * to improve latency. */
export async function newSpeak(txt: string, voice: string = randomVoice()) {
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

export const ssml = (...text: string[]) => {
  return `<speak>${text.join(" ")}</speak>`;
};

export const slow = (text: string) => {
  return `<prosody rate="slow">${text}</prosody>`;
};

export const en = (text: string) => {
  return `<voice language="en-US" gender="female">${text}</voice>`;
};

export const ko = (text: string) => {
  return text;
};

export const pause = (ms: number) => {
  return `<break time="${ms}ms"/>`;
};
