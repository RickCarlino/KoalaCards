import textToSpeech, {
  TextToSpeechClient,
  protos,
} from "@google-cloud/text-to-speech";
import { createHash } from "crypto";
import { draw } from "radash";
import { Gender, LangCode } from "./shared-types";
import { bucket } from "./storage";

type AudioLessonParams = {
  text: string;
  langCode: string;
  gender: Gender;
  speed?: number;
};

type LangLookTable = Record<LangCode, Record<Gender, string[]>>;

const Voices: LangLookTable = {
  en: {
    F: ["en-US-Wavenet-A", "en-US-Wavenet-B"],
    M: ["en-US-Wavenet-C", "en-US-Wavenet-D"],
    N: [
      "en-US-Wavenet-A",
      "en-US-Wavenet-B",
      "en-US-Wavenet-C",
      "en-US-Wavenet-D",
    ],
  },
  ko: {
    F: [
      "ko-KR-Wavenet-A",
      "ko-KR-Wavenet-B",
      "ko-KR-Wavenet-C",
      "ko-KR-Wavenet-D",
    ],
    M: [
      "ko-KR-Wavenet-A",
      "ko-KR-Wavenet-B",
      "ko-KR-Wavenet-C",
      "ko-KR-Wavenet-D",
    ],
    N: [
      "ko-KR-Wavenet-A",
      "ko-KR-Wavenet-B",
      "ko-KR-Wavenet-C",
      "ko-KR-Wavenet-D",
    ],
  },
  es: {
    F: ["es-ES-Wavenet-C", "es-ES-Wavenet-D"],
    M: ["es-ES-Wavenet-B"],
    N: ["es-ES-Wavenet-B", "es-ES-Wavenet-C", "es-ES-Wavenet-D"],
  },
  it: {
    F: ["it-IT-Wavenet-A", "it-IT-Wavenet-B"],
    M: ["it-IT-Wavenet-C", "it-IT-Wavenet-D"],
    N: [
      "it-IT-Wavenet-A",
      "it-IT-Wavenet-B",
      "it-IT-Wavenet-C",
      "it-IT-Wavenet-D",
    ],
  },
  fr: {
    F: ["fr-FR-Wavenet-A", "fr-FR-Wavenet-C"],
    M: ["fr-FR-Wavenet-B", "fr-FR-Wavenet-D"],
    N: [
      "fr-FR-Wavenet-A",
      "fr-FR-Wavenet-B",
      "fr-FR-Wavenet-C",
      "fr-FR-Wavenet-D",
    ],
  },
  ca: {
    F: ["ca-ES-Wavenet-A", "ca-ES-Wavenet-C"],
    M: ["ca-ES-Wavenet-B", "ca-ES-Wavenet-D"],
    N: [
      "ca-ES-Wavenet-A",
      "ca-ES-Wavenet-B",
      "ca-ES-Wavenet-C",
      "ca-ES-Wavenet-D",
    ],
  },
  cs: {
    F: ["cs-CZ-Wavenet-A", "cs-CZ-Wavenet-C"],
    M: ["cs-CZ-Wavenet-B"],
    N: ["cs-CZ-Wavenet-A", "cs-CZ-Wavenet-B", "cs-CZ-Wavenet-C"],
  },
  da: {
    F: ["da-DK-Wavenet-A"],
    M: ["da-DK-Wavenet-B"],
    N: ["da-DK-Wavenet-A", "da-DK-Wavenet-B"],
  },
  nl: {
    F: ["nl-NL-Wavenet-A"],
    M: ["nl-NL-Wavenet-B"],
    N: ["nl-NL-Wavenet-A", "nl-NL-Wavenet-B"],
  },
  fi: {
    F: ["fi-FI-Wavenet-A"],
    M: ["fi-FI-Wavenet-B"],
    N: ["fi-FI-Wavenet-A", "fi-FI-Wavenet-B"],
  },
  de: {
    F: ["de-DE-Wavenet-A", "de-DE-Wavenet-C"],
    M: ["de-DE-Wavenet-B", "de-DE-Wavenet-D"],
    N: [
      "de-DE-Wavenet-A",
      "de-DE-Wavenet-B",
      "de-DE-Wavenet-C",
      "de-DE-Wavenet-D",
    ],
  },
  el: {
    F: ["el-GR-Wavenet-A", "el-GR-Wavenet-C"],
    M: ["el-GR-Wavenet-B", "el-GR-Wavenet-D"],
    N: [
      "el-GR-Wavenet-A",
      "el-GR-Wavenet-B",
      "el-GR-Wavenet-C",
      "el-GR-Wavenet-D",
    ],
  },
  hi: {
    F: ["hi-IN-Wavenet-A", "hi-IN-Wavenet-C"],
    M: ["hi-IN-Wavenet-B", "hi-IN-Wavenet-D"],
    N: [
      "hi-IN-Wavenet-A",
      "hi-IN-Wavenet-B",
      "hi-IN-Wavenet-C",
      "hi-IN-Wavenet-D",
    ],
  },
  hu: {
    F: ["hu-HU-Wavenet-A", "hu-HU-Wavenet-C"],
    M: ["hu-HU-Wavenet-B"],
    N: ["hu-HU-Wavenet-A", "hu-HU-Wavenet-B", "hu-HU-Wavenet-C"],
  },
  id: {
    F: ["id-ID-Wavenet-A", "id-ID-Wavenet-C"],
    M: ["id-ID-Wavenet-B", "id-ID-Wavenet-D"],
    N: [
      "id-ID-Wavenet-A",
      "id-ID-Wavenet-B",
      "id-ID-Wavenet-C",
      "id-ID-Wavenet-D",
    ],
  },
  ja: {
    F: ["ja-JP-Wavenet-A", "ja-JP-Wavenet-C"],
    M: ["ja-JP-Wavenet-B", "ja-JP-Wavenet-D"],
    N: [
      "ja-JP-Wavenet-A",
      "ja-JP-Wavenet-B",
      "ja-JP-Wavenet-C",
      "ja-JP-Wavenet-D",
    ],
  },
  ms: {
    F: ["ms-MY-Wavenet-A"],
    M: ["ms-MY-Wavenet-B"],
    N: ["ms-MY-Wavenet-A", "ms-MY-Wavenet-B"],
  },
  nb: {
    F: ["nb-NO-Wavenet-A"],
    M: ["nb-NO-Wavenet-B"],
    N: ["nb-NO-Wavenet-A", "nb-NO-Wavenet-B"],
  },
  pl: {
    F: ["pl-PL-Wavenet-A", "pl-PL-Wavenet-C"],
    M: ["pl-PL-Wavenet-B", "pl-PL-Wavenet-D"],
    N: [
      "pl-PL-Wavenet-A",
      "pl-PL-Wavenet-B",
      "pl-PL-Wavenet-C",
      "pl-PL-Wavenet-D",
    ],
  },
  pt: {
    F: ["pt-PT-Wavenet-A", "pt-BR-Wavenet-A"],
    M: ["pt-PT-Wavenet-B", "pt-BR-Wavenet-B"],
    N: [
      "pt-PT-Wavenet-A",
      "pt-PT-Wavenet-B",
      "pt-BR-Wavenet-A",
      "pt-BR-Wavenet-B",
    ],
  },
  ro: {
    F: ["ro-RO-Wavenet-A"],
    M: ["ro-RO-Wavenet-B"],
    N: ["ro-RO-Wavenet-A", "ro-RO-Wavenet-B"],
  },
  ru: {
    F: ["ru-RU-Wavenet-A", "ru-RU-Wavenet-C"],
    M: ["ru-RU-Wavenet-B", "ru-RU-Wavenet-D"],
    N: [
      "ru-RU-Wavenet-A",
      "ru-RU-Wavenet-B",
      "ru-RU-Wavenet-C",
      "ru-RU-Wavenet-D",
    ],
  },
  sk: {
    F: ["sk-SK-Wavenet-A"],
    M: ["sk-SK-Wavenet-B"],
    N: ["sk-SK-Wavenet-A", "sk-SK-Wavenet-B"],
  },
  uk: {
    F: ["uk-UA-Wavenet-A"],
    M: ["uk-UA-Wavenet-B"],
    N: ["uk-UA-Wavenet-A", "uk-UA-Wavenet-B"],
  },
  vi: {
    F: ["vi-VN-Wavenet-A"],
    M: ["vi-VN-Wavenet-B"],
    N: ["vi-VN-Wavenet-A", "vi-VN-Wavenet-B"],
  },
  gl: {
    F: ["gl-ES-Wavenet-A"],
    M: ["gl-ES-Wavenet-B"],
    N: ["gl-ES-Wavenet-A", "gl-ES-Wavenet-B"],
  },
  gu: {
    F: ["gu-IN-Wavenet-A"],
    M: ["gu-IN-Wavenet-B"],
    N: ["gu-IN-Wavenet-A", "gu-IN-Wavenet-B"],
  },
  kn: {
    F: ["kn-IN-Wavenet-A"],
    M: ["kn-IN-Wavenet-B"],
    N: ["kn-IN-Wavenet-A", "kn-IN-Wavenet-B"],
  },
  lv: {
    F: ["lv-LV-Wavenet-A"],
    M: ["lv-LV-Wavenet-B"],
    N: ["lv-LV-Wavenet-A", "lv-LV-Wavenet-B"],
  },
  lt: {
    F: ["lt-LT-Wavenet-A"],
    M: ["lt-LT-Wavenet-B"],
    N: ["lt-LT-Wavenet-A", "lt-LT-Wavenet-B"],
  },
  mr: {
    F: ["mr-IN-Wavenet-A"],
    M: ["mr-IN-Wavenet-B"],
    N: ["mr-IN-Wavenet-A", "mr-IN-Wavenet-B"],
  },
  pa: {
    F: ["pa-IN-Wavenet-A"],
    M: ["pa-IN-Wavenet-B"],
    N: ["pa-IN-Wavenet-A", "pa-IN-Wavenet-B"],
  },
  sr: {
    F: ["sr-RS-Wavenet-A"],
    M: ["sr-RS-Wavenet-B"],
    N: ["sr-RS-Wavenet-A", "sr-RS-Wavenet-B"],
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

const randomVoice = (langCode: string, gender: string) => {
  const l1 = Voices[langCode as LangCode] || Voices.ko;
  const l2 = l1[gender as Gender] || l1.N;
  return draw(l2) || l2[0];
};

const VERSION = "v1"; // Bust cache with this. Be careful with changing this.

const callTTS = async (voice: string, params: AudioLessonParams) => {
  const p = params.text.includes("<speak>")
    ? { ssml: params.text }
    : { text: params.text };
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
      audioConfig: {
        audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
        speakingRate: params.speed || 1.0,
      },
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
  const base64UrlHash = hashURL(params.text, params.langCode, params.gender);
  const fileName = `lesson-audio/${base64UrlHash}.mp3`;
  const file = bucket.file(fileName);
  const [exists] = await file.exists();

  if (exists) {
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60,
    });
    return signedUrl;
  }

  const lang = params.langCode.slice(0, 2).toLocaleLowerCase();
  const voice = randomVoice(lang, params.gender);
  const response = await callTTS(voice, params);

  await file.save(response.audioContent as Buffer, {
    metadata: { contentType: "audio/mpeg" },
  });

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 1000 * 60 * 60,
  });

  return signedUrl;
}
