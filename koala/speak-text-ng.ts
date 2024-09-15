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

type LangLookTable = Record<LangCode | "en", Record<Gender, string[]>>;

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

// Generate Text to Speech audio, store in Google Cloud Storage, and return the URL to the audio file.
export async function speakText(params: AudioLessonParams): Promise<string> {
  console.log(`Create audio: ${params.text}`);

  const lang = params.langCode.slice(0, 2).toLocaleLowerCase();
  const voice = randomVoice(lang, params.gender);

  // Compute a URL-safe MD5 hash of text+lang+gender
  const hashInput = `${params.text}|${params.langCode}|${params.gender}`;
  const md5Hash = createHash("md5").update(hashInput).digest();
  const base64UrlHash = md5Hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Create a unique file name based on the hash
  const fileName = `lesson-audio/${base64UrlHash}.mp3`;

  // Get a reference to the GCS bucket and the file
  const file = bucket.file(fileName);

  // Check if the file already exists
  const [exists] = await file.exists();

  if (exists) {
    // Return the public URL to the existing file
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log(`Audio file already exists at: ${publicUrl}`);
    return publicUrl;
  }

  // Setup the request for TTS API
  const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
    {
      input: { text: params.text },
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

  // Generate the audio from the Text-to-Speech API
  const [response] = await CLIENT.synthesizeSpeech(request);

  // Save the audio content to the GCS file
  await file.save(response.audioContent as Buffer, {
    metadata: { contentType: "audio/mpeg" },
  });

  // Make the file publicly accessible
  await file.makePublic();

  // Return the public URL to the file
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  console.log(`Audio file stored at: ${publicUrl}`);

  return publicUrl;
}
