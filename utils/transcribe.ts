import { openai } from "@/server/routers/_app";
import { createReadStream, writeFile } from "fs";
import { uid } from "radash";
import { promisify } from "util";

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
  return matches[2];
};

type TranscriptionResult = { kind: "OK"; text: string } | { kind: "NO_SPEECH" };

const PROMPT_KO = "한국어 학생이 한국어 예문을 읽으려고 합니다.";
const PROMPT_EN = "Korean language learner translates sentences to English.";

export async function transcribeB64(
  lang: Lang,
  dataURI: string,
  user_id: string
): Promise<TranscriptionResult> {
  return new Promise(async (resolve) => {
    const writeFileAsync = promisify(writeFile);
    const base64Data = dataURI.split(";base64,").pop() || "";
    const buffer = Buffer.from(base64Data, "base64");
    const fpath = `/tmp/${uid(8)}.wav`;
    await writeFileAsync(fpath, buffer);
    const isEn = lang.slice(0, 2) === "en";
    const y = await openai.createTranscription(
      createReadStream(fpath) as any,
      "whisper-1",
      isEn ? PROMPT_EN : PROMPT_KO,
      "text"
    );

    return resolve({
      kind: "OK",
      text: (y && typeof y.data == "string" && y.data) || "NO RESPONSE.",
    });
  });
}
