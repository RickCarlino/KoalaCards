import textToSpeech, {
  TextToSpeechClient,
  protos,
} from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import { draw } from "radash";
import { storageProvider } from "./storage";
import { stripEmojis } from "./utils/emoji";

type AudioLessonParams = {
  text: string;
  langCode: string;
  speed?: number;
};

type VoicesTable = Record<string, string[]>;

const Voices: VoicesTable = {
  en: [
    "en-US-Wavenet-A",
    "en-US-Wavenet-B",
    "en-US-Wavenet-C",
    "en-US-Wavenet-D",
  ],
  ko: [
    "ko-KR-Wavenet-A",
    "ko-KR-Wavenet-B",
    "ko-KR-Wavenet-C",
    "ko-KR-Wavenet-D",
  ],
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

const randomVoice = (langCode: string) => {
  const voices = Voices[langCode] || Voices.ko;
  return draw(voices) || voices[0];
};

const VERSION = "v3";

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
          protos.google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL,
      },
      audioConfig,
    };

  const [response] = await CLIENT.synthesizeSpeech(request);

  return response;
};

const hashURL = (text: string, langCode: string) => {
  const hashInput = `${text}|${langCode}`;
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
  const base64UrlHash = hashURL(cleanText, params.langCode);
  const fileName = `lesson-audio/${base64UrlHash}.mp3`;
  const [exists] = await storageProvider.fileExists(fileName);

  if (exists) {
    return await storageProvider.getExpiringURL(fileName);
  }

  const lang = params.langCode.slice(0, 2).toLocaleLowerCase();
  const voice = randomVoice(lang);
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
