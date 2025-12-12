import textToSpeech, { protos } from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import { draw } from "radash";
import { Gender } from "./shared-types";
import { storageProvider } from "./storage";
import { parseOptionalJsonEnv } from "./utils/env";
import type { GcpCreds } from "./types/gcp-creds";
import { isGcpCreds } from "./types/gcp-creds";

type AudioLessonParams = {
  text: string;
  langCode: string;
  gender: Gender;
  speed?: number;
};

type VoicesTable = Record<string, Record<Gender, string[]>>;

const VOICES: VoicesTable = {
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

function createTextToSpeechClient(creds: GcpCreds | null) {
  if (!creds) {
    return new textToSpeech.TextToSpeechClient();
  }
  return new textToSpeech.TextToSpeechClient({
    projectId: creds.project_id,
    credentials: creds,
  });
}

function resolveGcpCredsFromEnv(): GcpCreds | null {
  const raw = parseOptionalJsonEnv("GCP_JSON_CREDS");
  if (raw === undefined) {
    return null;
  }
  if (!isGcpCreds(raw)) {
    throw new Error("Invalid GCP_JSON_CREDS");
  }
  return raw;
}

const CLIENT = createTextToSpeechClient(resolveGcpCredsFromEnv());

const VERSION = "v2";

function isSsml(text: string) {
  return text.includes("<speak>");
}

function buildTtsInput(text: string) {
  if (isSsml(text)) {
    return { ssml: text };
  }
  return { text };
}

const SSML_GENDER: Record<
  Gender,
  protos.google.cloud.texttospeech.v1.SsmlVoiceGender
> = {
  F: protos.google.cloud.texttospeech.v1.SsmlVoiceGender.FEMALE,
  M: protos.google.cloud.texttospeech.v1.SsmlVoiceGender.MALE,
  N: protos.google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL,
};

function pickVoice(langCode: string, gender: Gender) {
  const voicesByGender = VOICES[langCode] ?? VOICES.ko;
  const voices = voicesByGender[gender] ?? voicesByGender.N;
  return draw(voices) ?? voices[0];
}

function audioContentToBuffer(audioContent: unknown): Buffer {
  if (!audioContent) {
    throw new Error("TTS response missing audioContent");
  }
  if (typeof audioContent === "string") {
    return Buffer.from(audioContent, "base64");
  }
  if (audioContent instanceof Uint8Array) {
    return Buffer.from(audioContent);
  }
  throw new Error("TTS audioContent has an unexpected type");
}

async function callTts(voice: string, params: AudioLessonParams) {
  const audioConfig: protos.google.cloud.texttospeech.v1.IAudioConfig = {
    audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
    speakingRate: params.speed ?? 1.0,
  };

  const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
    {
      input: buildTtsInput(params.text),
      voice: {
        languageCode: params.langCode,
        name: voice,
        ssmlGender: SSML_GENDER[params.gender],
      },
      audioConfig,
    };

  const [response] = await CLIENT.synthesizeSpeech(request);

  return response;
}

function hashURL(text: string, langCode: string, gender: Gender) {
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
}

export async function generateSpeechURL(
  params: AudioLessonParams,
): Promise<string> {
  const base64UrlHash = hashURL(
    params.text,
    params.langCode,
    params.gender,
  );
  const fileName = `lesson-audio/${base64UrlHash}.mp3`;
  const [exists] = await storageProvider.fileExists(fileName);

  if (exists) {
    return await storageProvider.getExpiringURL(fileName);
  }

  const lang = params.langCode.slice(0, 2).toLocaleLowerCase();
  const voice = pickVoice(lang, params.gender);
  const response = await callTts(voice, params);
  const audioBuffer = audioContentToBuffer(response.audioContent);

  await storageProvider.saveBuffer(fileName, audioBuffer, {
    metadata: { contentType: "audio/mpeg" },
  });

  return await storageProvider.getExpiringURL(fileName);
}
