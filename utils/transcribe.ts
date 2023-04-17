import { SpeechClient } from "@google-cloud/speech";

type Lang = "ko" | "en-US";
const UNKNOWN = "ENCODING_UNSPECIFIED" as any
const ENCODING_TABLE: Record<string, string> = {
  "audio/amr-wb": "AMR_WB",
  "Audio/amr": "AMR",
  "audio/flac": "FLAC",
  "audio/l16": "LINEAR16",
  "audio/ogg": "OGG_OPUS",
  "audio/webm": "WEBM_OPUS",
  "audio/x-mulaw": "MULAW",
  "audio/x-speex-with-header-byte": "SPEEX_WITH_HEADER_BYTE",
};

export async function transcribeB64(
  lang: Lang,
  dataURI: string
): Promise<string> {
  const client = new SpeechClient();
  return new Promise(async (resolve) => {
    const mime = dataURI.split(",")[0].split(":")[1].split(";")[0];
    const content = dataURI.split(",")[1];
    const encoding = ENCODING_TABLE[mime.toLowerCase()] || UNKNOWN; // TODO: fix type
    const [resp] = await client.recognize({
      config: {
        encoding,
        sampleRateHertz: 48000,
        languageCode: lang,
      },
      audio: {
        content,
      },
    });
    const speech = resp?.results?.[0]?.alternatives?.[0]?.transcript;
    if (!speech) {
      console.log("===")
      console.log(dataURI.slice(0, 100));
      throw new Error(
        "No speech detected. See `error.ogg` to inspect. " +
          JSON.stringify(resp)
      );
    }
    resolve(speech);
  });
}
