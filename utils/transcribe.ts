import { SpeechClient } from "@google-cloud/speech";

// `base64Audio` looks like this:
//   "data:audio/ogg; codecs=opus;base64,T2dnUwACAAAAAAAA..."
type Lang = "ko" | "en-US";
export async function transcribeB64(
  lang: Lang,
  base64Audio: string
): Promise<string> {
  const client = new SpeechClient();
  return new Promise(async (resolve) => {
    const content = base64Audio.split(",")[1];
    const conf = {
      config: {
        encoding: "OGG_OPUS",
        sampleRateHertz: 48000,
        languageCode: lang,
      },
      audio: {
        content,
      },
    } as const;
    const [resp] = await client.recognize(conf);
    const speech = resp?.results?.[0]?.alternatives?.[0]?.transcript;
    if (!speech) throw new Error("No speech detected: " + JSON.stringify(resp));
    resolve(speech);
  });
}
