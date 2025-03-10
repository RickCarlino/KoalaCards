import { createReadStream, writeFile, unlink } from "fs";
import path from "path";
import { uid } from "radash";
import { promisify } from "util";
import { SafeCounter } from "./counter";
import { openai } from "./openai";
import { LangCode } from "./shared-types";

type TranscriptionResult = { kind: "OK"; text: string } | { kind: "error" };

const transcriptionLength = SafeCounter({
  name: "transcriptionLength",
  help: "Number of characters transcribed.",
  labelNames: ["userID"],
});

export async function transcribeB64(
  dataURI: string,
  userID: string | number,
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
  const transcribePromise = new Promise<TranscriptionResult>(
    async (resolve) => {
      try {
        const y = await openai.audio.transcriptions.create({
          file: createReadStream(fpath) as any,
          model: "whisper-1",
          prompt,
          language,
        });
        const text = y.text || "NO RESPONSE.";
        transcriptionLength.labels({ userID }).inc(y.text.length);
        return resolve({
          kind: "OK",
          text,
        });
      } catch (error) {
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
