import { readFile } from "fs/promises";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import { shuffle, uid, unique } from "radash";
import { transcribeAudio } from "./ai";
import { LangCode, supportedLanguages } from "./shared-types";

type TranscriptionResult =
  | { kind: "OK"; text: string }
  | { kind: "error" };

export async function transcribeB64(
  dataURI: string,
  _userID: string | number,
  targetSentence: string,
  language: LangCode,
): Promise<TranscriptionResult> {
  const buffer = Buffer.from(
    dataURI.split(";base64,").pop() ?? "",
    "base64",
  );
  const fpath = path.join("/tmp", `${uid(8)}.wav`);
  await writeFile(fpath, buffer);

  const languageName = supportedLanguages[language] || language;
  const randomHint = shuffle(
    unique(
      targetSentence
        .split(/\s+|[.,!?;:()]/)
        .filter(Boolean)
        .sort(),
    ),
  )[0] || "common words";
  const prompt = `It's ${languageName} audio containing ${randomHint}`;
  console.log(`=== Transcribing with prompt: ${prompt}`);
  try {
    const audioBuffer = await readFile(fpath);
    const text = await transcribeAudio(audioBuffer, {
      // Language is off
      model: "gpt-4o-transcribe",
      prompt,
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
