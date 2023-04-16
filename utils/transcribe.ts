import { SpeechClient } from "@google-cloud/speech";

// `base64Audio` looks like this:
//   "data:audio/ogg; codecs=opus;base64,T2dnUwACAAAAAAAA..."
export async function transcribeB64(base64Audio: string): Promise<string> {
  const client = new SpeechClient();
  return new Promise(async (resolve) => {
    const content = base64Audio.split(",")[1];
    const x = await client.recognize({
      config: {
        encoding: "OGG_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
      },
      audio: {
        content,
      },
    });
    console.log("Does not work...");
    resolve(JSON.stringify(x, null, 2));
  });
}
