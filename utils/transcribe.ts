import { openai } from "@/server/routers/perform-exam";
import { createReadStream, writeFile } from "fs";
import path from "path";
import { uid } from "radash";
import { promisify } from "util";

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

const PROMPT_KO = "한국어 학생이 한국어 예문을 읽으려고 합니다.";
const PROMPT_EN = "Korean language learner translates sentences to English.";

export async function transcribeB64(
  lang: Lang,
  dataURI: string,
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
        const y = await openai.createTranscription(
          createReadStream(fpath) as any,
          "whisper-1",
          isEn ? PROMPT_EN : PROMPT_KO,
          "text",
        );
        const text =
          (y && typeof y.data == "string" && y.data) || "NO RESPONSE.";
        done = true;
        return resolve({
          kind: "OK",
          text,
        });
      } catch (error) {
        console.error(error);
        return resolve({ kind: "error" });
      }
    },
  );

  const timeoutPromise = new Promise<TranscriptionResult>((resolve, _) =>
    setTimeout(() => {
      if (!done) {
        resolve({ kind: "error" });
      }
    }, 8000),
  );

  return Promise.race([transcribePromise, timeoutPromise]);
}
