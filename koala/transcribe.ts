import { readFile } from "fs/promises";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import { uid } from "radash";
import { transcribeAudio } from "./ai";
import { LangCode } from "./shared-types";

type TranscriptionResult =
  | { kind: "OK"; text: string }
  | { kind: "error" };

export async function transcribeB64(
  dataURI: string,
  _userID: string | number,
  _prompt: string,
  language: LangCode,
): Promise<TranscriptionResult> {
  const buffer = Buffer.from(
    dataURI.split(";base64,").pop() ?? "",
    "base64",
  );
  const fpath = path.join("/tmp", `${uid(8)}.wav`);
  await writeFile(fpath, buffer);

  try {
    const audioBuffer = await readFile(fpath);
    const text = await transcribeAudio(audioBuffer, {
      model: "gpt-4o-transcribe",
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
