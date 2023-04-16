import { SpeechClient } from "@google-cloud/speech";

const client = new SpeechClient();

export async function transcribeB64(base64Audio: string): Promise<string> {
return new Promise(async (resolve, reject) => {
  const [response] = await client.recognize({
    config: {
      encoding: "OGG_OPUS",
      sampleRateHertz: 48000, // Opts: 8000, 12000, 16000, 24000, 48000
      languageCode: "en-US",
      speechContexts: [],
    },
    audio: {
      content: base64Audio.split(",")[1],
    },
  });
  const result = response.results ?? [];
  const firstResult = result[0];
  const alternative = firstResult?.alternatives?.[0];
  if (alternative?.transcript) {
    resolve(alternative.transcript);
  } else {
    resolve(JSON.stringify(response, null, 2));
  }
})}
