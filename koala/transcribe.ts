import { createReadStream, writeFile, unlink } from "fs";
import path from "path";
import { uid, unique } from "radash";
import { promisify } from "util";
import { openai } from "./openai";
import { LangCode } from "./shared-types";

type TranscriptionResult =
  | { kind: "OK"; text: string }
  | { kind: "error" };

export async function transcribeB64(
  dataURI: string,
  _userID: string | number,
  prompt: string,
  language: LangCode,
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
  // Words split on whitespace and punctuation
  const words = prompt
    .split(/\s+|[.,!?;:()]/)
    .filter(Boolean)
    .sort();
  const transcribePromise = new Promise<TranscriptionResult>(
    async (resolve) => {
      try {
        const y = await openai.audio.transcriptions.create({
          file: createReadStream(fpath) as any,
          model: "gpt-4o-transcribe",
          prompt:
            "Might contains these words or related words: " +
            unique(words).join(" "),
          language,
        });
        const text = y.text;
        if (!text) {
          throw new Error("No text returned from transcription.");
        }
        console.log(`=== Transcription: ${text}`);
        const OPENAI_API_BUG = text.split("\n")[0];
        return resolve({
          kind: "OK",
          text: OPENAI_API_BUG,
        });
      } catch (error) {
        throw error;
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
