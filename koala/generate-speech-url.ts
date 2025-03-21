import OpenAI from "openai";
import { createHash } from "crypto";
import { bucket } from "./storage";

const openai = new OpenAI();

export type AudioLessonParams = {
  text: string;
  // Retained for backwards compatibility, but they are no longer used
  langCode: string;
  gender: string;
  speed?: number;
};

// All voices available regardless of language/gender
const voices = ["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"] as const;
type Voice = typeof voices[number];
const randomVoice = () => voices[Math.floor(Math.random() * voices.length)] as "alloy";

const VERSION = "v4"; // Cache-busting version

// New API call using OpenAI's TTS model
const callTTS = async (voice: Voice, params: AudioLessonParams) => {
  // Note: SSML and speed are not supported on the new API.
  const instructions = `You are a foreign language instructor teaching example sentences to a class.
  For English sentences, speak plainly.
  For non-English sentences, speak clearly and with amplified emotions that echo the sentiment of the sentence."`
  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice,
    input: params.text,
    instructions,
  });
  return response;
};

// For caching, we now hash only the text (ignoring langCode and gender)
const hashURL = (text: string) => {
  const hashInput = text;
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
  // Use only the text to generate the cache key.
  const base64UrlHash = hashURL(params.text);
  const fileName = `lesson-audio/${base64UrlHash}.mp3`;
  const file = bucket.file(fileName);
  const [exists] = await file.exists();

  if (exists) {
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60, // 1 hour expiration
    });
    return signedUrl;
  }

  // Pick a random voice from our list
  const voice = randomVoice();
  const response = await callTTS(voice, params);

  // Convert the returned ArrayBuffer into a Buffer
  const buffer = Buffer.from(await response.arrayBuffer());
  await file.save(buffer, {
    metadata: { contentType: "audio/mpeg" },
  });

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 1000 * 60 * 60,
  });

  return signedUrl;
}
