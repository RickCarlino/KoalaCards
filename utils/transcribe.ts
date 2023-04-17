import { SpeechClient } from "@google-cloud/speech";
import { google } from "@google-cloud/speech/build/protos/protos";
import { writeFileSync } from "fs";

function dataURItoBlob(dataURI: string) {
  // convert base64 to raw binary data held in a string
  var data = dataURI.split(",")[1];
  var byteString = Buffer.from(data, "base64");

  // separate out the mime component
  var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  // write the ArrayBuffer to a blob, and you're done
  return new Blob([byteString], { type: mimeString });
}

// `base64Audio` looks like this:
//   "data:audio/ogg; codecs=opus;base64,T2dnUwACAAAAAAAA..."
type Lang = "ko" | "en-US";
type AudioEncoding =
  | "AMR_WB"
  | "AMR"
  | "FLAC"
  | "LINEAR16"
  | "OGG_OPUS"
  | "WEBM_OPUS"
  | "MULAW"
  | "SPEEX_WITH_HEADER_BYTE";
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
    const array = dataURI.split(",");
    if (array.length !== 2) throw new Error("Invalid base64Audio");
    const content = array[1];
    const blob = dataURItoBlob(dataURI);
    console.log(blob.type);
    const [resp] = await client.recognize({
      config: {
        encoding: ENCODING_TABLE[blob.type.toLowerCase()] || "ENCODING_UNSPECIFIED" as any, // TODO: fix type
        sampleRateHertz: 48000,
        languageCode: lang,
      },
      audio: {
        content,
      },
    });
    const speech = resp?.results?.[0]?.alternatives?.[0]?.transcript;
    if (!speech) {
      writeFileSync("error.ogg", Buffer.from(content, "base64"));
      console.log(dataURI.slice(0, 100));
      throw new Error(
        "No speech detected. See `error.ogg` to inspect. " +
          JSON.stringify(resp)
      );
    }
    resolve(speech);
  });
}
