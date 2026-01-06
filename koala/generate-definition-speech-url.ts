import OpenAI from "openai";
import { createHash } from "crypto";
import { storageProvider } from "./storage";
import { stripEmojis } from "./utils/emoji";

const VOICE = "alloy";
const MODEL = "gpt-4o-mini-tts-2025-12-15";
const VERSION = "v1";
const AUDIO_FORMAT = "mp3";

let client: OpenAI | null = null;

const getClient = () => {
  if (client) {
    return client;
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
};

const hashInput = (text: string) => {
  const normalized = text.trim();
  const hashInputValue = `${VERSION}|${normalized}`;
  const hash = createHash("md5")
    .update(hashInputValue)
    .digest("base64url");
  return hash;
};

export async function generateDefinitionSpeechURL(
  text: string,
): Promise<string> {
  const cleanText = stripEmojis(text).trim();
  if (!cleanText) {
    throw new Error("No definition text provided for TTS.");
  }

  const hash = hashInput(cleanText);
  const fileName = `lesson-definition-audio/${hash}.${AUDIO_FORMAT}`;

  const [exists] = await storageProvider.fileExists(fileName);
  if (exists) {
    return await storageProvider.getExpiringURL(fileName);
  }

  const openai = getClient();
  const response = await openai.audio.speech.create({
    model: MODEL,
    voice: VOICE,
    input: cleanText,
    response_format: AUDIO_FORMAT,
  });
  const buffer = Buffer.from(await response.arrayBuffer());

  await storageProvider.saveBuffer(fileName, buffer, {
    metadata: { contentType: "audio/mpeg" },
  });

  return await storageProvider.getExpiringURL(fileName);
}
