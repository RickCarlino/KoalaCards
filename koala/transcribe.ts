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
  console.log("[transcribeB64] begin", {
    dataLen: dataURI?.length ?? 0,
    sample: dataURI?.slice(0, 64) ?? "",
  });
  const commaIdx = dataURI.indexOf(",");
  const header = commaIdx > -1 ? dataURI.slice(0, commaIdx) : "";
  const base64 = commaIdx > -1 ? dataURI.slice(commaIdx + 1) : dataURI;
  const mimeMatch = header.match(/^data:([^;]+(?:;[^,]+)?)?;base64$/);
  const fullMime = mimeMatch ? (mimeMatch[1] ?? "audio/wav") : "audio/wav";
  // Strip parameters like ";codecs=opus"
  const mime = fullMime.split(";")[0];

  const extMap: Record<string, string> = {
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/m4a": "mp4",
    // Avoid raw AAC; prefer mp4/m4a container
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
  };
  const ext = extMap[mime] ?? "wav";
  console.log("[transcribeB64] parsed header", {
    header,
    mime,
    fullMime,
    mappedExt: ext,
    b64Len: base64?.length ?? 0,
  });
  const buffer = Buffer.from(base64, "base64");
  const filename = `input.${ext}`;
  const fpath = path.join("/tmp", `${uid(8)}.${ext}`);
  await writeFile(fpath, buffer);
  try {
    const { statSync } = await import("fs");
    const { size } = statSync(fpath);
    console.log("[transcribeB64] wrote file", { fpath, size });
  } catch (e) {
    console.error("[transcribeB64] stat error", e);
  }

  const languageName = supportedLanguages[language] || language;
  const randomHint =
    shuffle(
      unique(
        targetSentence
          .split(/\s+|[.,!?;:()]/)
          .filter(Boolean)
          .sort(),
      ),
    )[0] || "common words";
  const prompt = `It's ${languageName} audio containing ${randomHint}`;
  console.log("[transcribeB64] prompt", { prompt });
  try {
    const audioBuffer = await readFile(fpath);
    console.log("[transcribeB64] buffer", { byteLen: audioBuffer.length });
    const model = "gpt-4o-mini-transcribe";
    console.log("[transcribeB64] call openai", { model, filename });
    const text = await transcribeAudio(audioBuffer, {
      model,
      prompt,
      filename,
    });
    console.log("[transcribeB64] openai success", {
      textLen: text.length,
      sample: text.slice(0, 64),
    });
    return { kind: "OK", text: text.split("\n")[0] };
  } catch (err) {
    console.error("[transcribeB64] openai error", err);
    return { kind: "error" };
  } finally {
    unlink(fpath).catch((e) =>
      console.error(`Delete Err: ${JSON.stringify(e)}`),
    );
  }
}
