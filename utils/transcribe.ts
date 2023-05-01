import { SpeechClient } from "@google-cloud/speech";

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
export async function transcribeB64(
  lang: Lang,
  dataURI: string
): Promise<TranscriptionResult> {
  const client = new SpeechClient();
  return new Promise(async (resolve) => {
    const [resp] = await client.recognize({
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 44100, // Default sample rate for AudioContext, unless specified otherwise
        languageCode: lang,
      },
      audio: {
        content: captureAudio(dataURI),
      },
    });
    const speech = resp?.results?.[0]?.alternatives?.[0]?.transcript;
    if (!speech) {
      return resolve({ kind: "NO_SPEECH" });
    }
    return resolve({ kind: "OK", text: speech });
  });
}
