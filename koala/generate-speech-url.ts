import textToSpeech, {
  TextToSpeechClient,
  protos,
} from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import { draw } from "radash";
import { Gender } from "./shared-types";
import { storageProvider } from "./storage";
import { stripEmojis } from "./utils/emoji";

type AudioLessonParams = {
  text: string;
  langCode: string;
  gender: Gender;
  speed?: number;
};

type VoicesTable = Record<string, Record<Gender, string[]>>;

const Voices: VoicesTable = {
  en: {
    F: ["en-US-Wavenet-C"],
    M: ["en-US-Wavenet-A", "en-US-Wavenet-B", "en-US-Wavenet-D"],
    N: [
      "en-US-Wavenet-A",
      "en-US-Wavenet-B",
      "en-US-Wavenet-C",
      "en-US-Wavenet-D",
    ],
  },
  ko: {
    F: ["ko-KR-Wavenet-A", "ko-KR-Wavenet-B"],
    M: ["ko-KR-Wavenet-C", "ko-KR-Wavenet-D"],
    N: [
      "ko-KR-Wavenet-A",
      "ko-KR-Wavenet-B",
      "ko-KR-Wavenet-C",
      "ko-KR-Wavenet-D",
    ],
  },
};

let CLIENT: TextToSpeechClient;
const creds = JSON.parse(process.env.GCP_JSON_CREDS || "false");
if (creds) {
  CLIENT = new textToSpeech.TextToSpeechClient({
    projectId: creds.project_id,
    credentials: creds,
  });
} else {
  CLIENT = new textToSpeech.TextToSpeechClient();
}

const randomVoice = (langCode: string, gender: Gender) => {
  const l1 = Voices[langCode] || Voices.ko;
  const l2 = l1[gender] || l1.N;
  return draw(l2) || l2[0];
};

const VERSION = "v2";

const callTTS = async (voice: string, params: AudioLessonParams) => {
  const p = params.text.includes("<speak>")
    ? { ssml: params.text }
    : { text: params.text };
  const audioConfig: protos.google.cloud.texttospeech.v1.IAudioConfig = {
    audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
  };
  audioConfig.speakingRate = params.speed || 1.0;

  const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
    {
      input: p,
      voice: {
        languageCode: params.langCode,
        name: voice,
        ssmlGender:
          protos.google.cloud.texttospeech.v1.SsmlVoiceGender[
            params.gender as keyof typeof protos.google.cloud.texttospeech.v1.SsmlVoiceGender
          ],
      },
      audioConfig,
    };

  const [response] = await CLIENT.synthesizeSpeech(request);

  return response;
};

const hashURL = (text: string, langCode: string, gender: string) => {
  const hashInput = `${text}|${langCode}|${gender}`;
  const md5Hash = createHash("md5").update(hashInput).digest();
  const base64UrlHash =
    VERSION +
    md5Hash
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return base64UrlHash;
};

export async function generateSpeechURL(
  params: AudioLessonParams,
): Promise<string> {
  const cleanText = stripEmojis(params.text);
  const base64UrlHash = hashURL(cleanText, params.langCode, params.gender);
  const fileName = `lesson-audio/${base64UrlHash}.mp3`;
  const [exists] = await storageProvider.fileExists(fileName);

  if (exists) {
    return await storageProvider.getExpiringURL(fileName);
  }

  const lang = params.langCode.slice(0, 2).toLocaleLowerCase();
  const voice = randomVoice(lang, params.gender);
  const response = await callTTS(voice, { ...params, text: cleanText });

  await storageProvider.saveBuffer(
    fileName,
    response.audioContent as Buffer,
    {
      metadata: { contentType: "audio/mpeg" },
    },
  );

  return await storageProvider.getExpiringURL(fileName);
}
