import { SpeechClient } from "@google-cloud/speech";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { uid } from "radash";

export type Lang = "ko" | "en-US";

export const captureAudio = (dataURI: string) => {
  const regex = /^data:.+\/(.+);base64,(.*)$/;
  const matches = dataURI.match(regex);
  if (!matches || matches.length !== 3) return new Error("Invalid input string");
  const ext = matches[1].slice(0, 4).toLowerCase().replace(/[^a-z]/gi, ''); // security critical
  const data = matches[2];
  const id = uid(8);
  const input = `/tmp/koala-audio-${id}.${ext}`;
  const output = `/tmp/koala-audio-${id}.webm`;
  const buffer = Buffer.from(data, "base64"); // TODO: Set a cap on length.
  writeFileSync(input, buffer); // TODO: Use non-synchronous version
  // Convert file from mp4 to ogg
  execSync(`ffmpeg -i ${input} -c:a libopus -ar 48000 -b:a 128k -ac 1 ${output}`);
  return readFileSync(output, "base64"); // TODO: Use non-synchronous version
};

export async function transcribeB64(
  lang: Lang,
  dataURI: string
): Promise<string> {
  const client = new SpeechClient();
  return new Promise(async (resolve) => {
    const [resp] = await client.recognize({
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: lang,
      },
      audio: {
        content: captureAudio(dataURI) as string,
      },
    });
    const speech = resp?.results?.[0]?.alternatives?.[0]?.transcript;
    if (!speech) {
      throw new Error(
        "No speech detected. See `error.ogg` to inspect. " +
          JSON.stringify(resp)
      );
    }
    resolve(speech);
  });
}
