import { SpeechClient } from "@google-cloud/speech";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { uid } from "radash";

export type Lang = "ko" | "en-US";

export const captureAudio = (dataURI: string): string => {
  const regex = /^data:.+\/(.+);base64,(.*)$/;
  const matches = dataURI.match(regex);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid input string");
  }
  const ext = matches[1]
    .slice(0, 4)
    .toLowerCase()
    .replace(/[^a-z]/gi, ""); // security critical
  const data = matches[2];
  const id = uid(8);
  const input = `/tmp/koala-audio-${id}.${ext}`;
  const output = `/tmp/koala-audio-${id}.webm`;
  const buffer = Buffer.from(data, "base64"); // TODO: Set a cap on length.
  writeFileSync(input, buffer); // TODO: Use non-synchronous version
  // Convert file from mp4 to ogg
  execSync(
    `ffmpeg -i ${input} -c:a libopus -ar 48000 -b:a 128k -ac 1 ${output}`
  );
  return readFileSync(output, "base64");
};

type TranscriptionResult = { kind: "OK"; text: string } | { kind: "NO_SPEECH" };
export async function transcribeB64(
  lang: Lang,
  dataURI: string
): Promise<TranscriptionResult> {
  const client = new SpeechClient();
  return new Promise(async (resolve) => {
    const [resp] = await client.recognize({
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: lang,
      },
      audio: {
        content: captureAudio(dataURI),
      },
    });
    const speech = resp?.results?.[0]?.alternatives?.[0]?.transcript;
    if (!speech) {
      return resolve({ kind: "NO_SPEECH" });
    }
    return resolve({ kind: "OK", text: speech });
  });
}
