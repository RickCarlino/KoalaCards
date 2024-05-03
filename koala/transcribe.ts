import { createReadStream, writeFile, unlink } from "fs";
import path from "path";
import { uid } from "radash";
import { promisify } from "util";
import { SafeCounter } from "./counter";
import { errorReport } from "./error-report";
import { openai } from "./openai";
import { LangCode } from "./shared-types";

export const captureAudio = (dataURI: string): string => {
  const regex = /^data:.+\/(.+);base64,(.*)$/;
  const matches = dataURI.match(regex);
  if (!matches || matches.length !== 3) {
    return errorReport("Invalid input string");
  }
  return matches[2];
};

type TranscriptionResult = { kind: "OK"; text: string } | { kind: "error" };

const PROMPTS: Record<string, string> = {
  ko: "다양한 한국어 예문을 읽는 연습",
  en: "Reading diverse example sentences in English ",
  it: "Esercizio di lettura di frasi esemplificative in italiano",
  fr: "Exercice de lecture de phrases d'exemple en français",
  es: "Ejercicio de lectura de frases de ejemplo en español",
};

const transcriptionLength = SafeCounter({
  name: "transcriptionLength",
  help: "Number of characters transcribed.",
  labelNames: ["lang", "userID"],
});

export async function transcribeB64(
  lang: LangCode | "en-US",
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
  const prompt = PROMPTS[lang.slice(0, 2)] || PROMPTS.ko;
  const transcribePromise = new Promise<TranscriptionResult>(
    async (resolve) => {
      try {
        const y = await openai.audio.transcriptions.create({
          file: createReadStream(fpath) as any,
          model: "whisper-1",
          prompt,
        });
        const text = y.text || "NO RESPONSE.";
        transcriptionLength.labels({ lang, userID }).inc(y.text.length);
        return resolve({
          kind: "OK",
          text,
        });
      } catch (error) {
        console.log("server side transcription error:");
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

  return transcribePromise;
}
