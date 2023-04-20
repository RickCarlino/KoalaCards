import textToSpeech from "@google-cloud/text-to-speech";
import fs, { existsSync, writeFileSync } from "fs";
import util from "util";
import { createHash } from "crypto";
import { draw } from "radash";
import { play } from "./play";

const CLIENT = new textToSpeech.TextToSpeechClient();

const VOICES = [
  // "ko-KR-Neural2-A",
  "ko-KR-Neural2-B",
  "ko-KR-Neural2-C",
  // "ko-KR-Standard-B",
  // "ko-KR-Standard-C",
  // "ko-KR-Standard-D",
  // "ko-KR-Wavenet-A",
  "ko-KR-Wavenet-B",
  "ko-KR-Wavenet-C",
  // "ko-KR-Wavenet-D",
];

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

/** Create and play a text to speech MP3 via Google Cloud.
 * Stores previously synthesized speech in a cache directory
 * to improve latency. */
export async function speak(txt: string, voice: string = randomVoice()) {
  try {
    const p = filePathFor(txt, voice);
    if (!existsSync(p)) {
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
      // TODO: Use async version
      await writeFileSync(p, response.audioContent, "binary");
    }
    play(p);
    return p;
  } catch (error) {
    console.log('='.repeat(80));
    console.log(JSON.stringify({
      text: txt,
      voice,
    }));
    console.error(JSON.stringify(error, null, 2));
  }
}
