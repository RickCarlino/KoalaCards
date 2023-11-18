import { openai } from "@/server/routers/perform-exam";
import { createReadStream, writeFile, unlink } from "fs";
import path from "path";
import { uid } from "radash";
import { promisify } from "util";
import { SafeCounter } from "./counter";

export type Lang = "ko" | "en-US";

export const captureAudio = (dataURI: string): string => {
  const regex = /^data:.+\/(.+);base64,(.*)$/;
  const matches = dataURI.match(regex);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid input string");
  }
  return matches[2];
};

type TranscriptionResult = { kind: "OK"; text: string } | { kind: "error" };

const PROMPT_KO = "한국어 학생이 한국어로 말씁합니다.";
const PROMPT_EN = "Korean language learner translates sentences to English.";

const transcriptionLength = SafeCounter({
  name: "transcriptionLength",
  help: "Number of characters transcribed.",
  labelNames: ["lang", "userID"],
});

export async function transcribeB64(
  lang: Lang,
  dataURI: string,
  userID: string | number,
): Promise<TranscriptionResult> {
  const writeFileAsync = promisify(writeFile);
  const base64Data = dataURI.split(";base64,").pop() || "";
  const buffer = Buffer.from(base64Data, "base64");
  const fpath = path.format({
    dir: path.join("/", "tmp"),
    name: uid(8),
    ext: ".wav",
  });
  await writeFileAsync(fpath, buffer);
  const isEn = lang.slice(0, 2) === "en";
  let done = false;
  const transcribePromise = new Promise<TranscriptionResult>(
    async (resolve) => {
      try {
        const y = await openai.audio.transcriptions.create({
          file: createReadStream(fpath) as any,
          model: "whisper-1",
          prompt: isEn ? PROMPT_EN : PROMPT_KO,
        });
        const text = y.text || "NO RESPONSE.";
        done = true;
        transcriptionLength.labels({ lang, userID }).inc(y.text.length);
        return resolve({
          kind: "OK",
          text,
        });
      } catch (error) {
        console.log("serverside transcription error:");
        console.error(error);
        return resolve({ kind: "error" });
      } finally {
        // Delete the file now that we are done:
        unlink(
          fpath,
          (e) => e && console.error("Delete Err: " + JSON.stringify(e)),
        );
      }
    },
  );

  const timeoutPromise = new Promise<TranscriptionResult>((resolve, _) =>
    setTimeout(() => {
      if (!done) {
        console.log("serverside transcription timeout");
        resolve({ kind: "error" });
      }
    }, 5000),
  );

  return Promise.race([transcribePromise, timeoutPromise]);
}
