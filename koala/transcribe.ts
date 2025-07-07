import { createReadStream } from "fs";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import { uid, unique } from "radash";
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
  const buffer = Buffer.from(
    dataURI.split(";base64,").pop() ?? "",
    "base64",
  );
  const fpath = path.join("/tmp", `${uid(8)}.wav`);
  await writeFile(fpath, buffer);

  const promptWords = unique(
    prompt
      .split(/\s+|[.,!?;:()]/)
      .filter(Boolean)
      .sort(),
  ).join(" ");

  try {
    const file = createReadStream(fpath);
    const { text = "" } = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-transcribe",
      prompt: `Might contains these words or related words: ${promptWords}`,
      language,
    });
    return { kind: "OK", text: text.split("\n")[0] };
  } catch (e) {
    console.error(`Transcription Error: ${JSON.stringify(e)}`);
    return { kind: "error" };
  } finally {
    unlink(fpath).catch((e) =>
      console.error(`Delete Err: ${JSON.stringify(e)}`),
    );
  }
}
