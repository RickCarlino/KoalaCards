import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { draw } from "radash";
import { stripEmojis } from "@/koala/utils/emoji";
import {
  requireJsonOpenAiApiKey,
  requireJsonPostMethod,
} from "@/koala/api/next-api";
import { requireJsonApiUser } from "@/koala/get-api-user";
import {
  buildSpeechInput,
  resolveSpeechContentType,
  resolveSpeechFormat,
} from "@/koala/api/speech-helpers";
import { OPENAI_SPEECH_MODEL } from "@/koala/ai-openai-config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type SpeechBody = {
  tl?: string;
  en?: string;
  format?: "wav" | "mp3" | "opus";
};

async function requireAuthenticatedSpeechUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<boolean> {
  return Boolean(await requireJsonApiUser(req, res));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireJsonPostMethod(req, res)) {
    return;
  }

  if (!(await requireAuthenticatedSpeechUser(req, res))) {
    return;
  }

  if (!requireJsonOpenAiApiKey(res)) {
    return;
  }

  const { tl, en, format } = (req.body ?? {}) as SpeechBody;
  const tlText = (tl ?? "").toString();
  const enText = (en ?? "").toString();
  const cleanTlText = stripEmojis(tlText);
  const cleanEnText = stripEmojis(enText);
  const input = buildSpeechInput(cleanTlText, cleanEnText);
  if (!input) {
    return res.status(400).json({ error: "Missing 'tl'" });
  }

  const VOICES = [
    "alloy",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
  ] as const;
  const chosenFormat = resolveSpeechFormat(format);

  const speech = await openai.audio.speech.create({
    model: OPENAI_SPEECH_MODEL,
    voice: draw(VOICES) || VOICES[0],
    input,
    response_format: chosenFormat,
  });

  const arrayBuffer = await speech.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType = resolveSpeechContentType(chosenFormat);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", buffer.length.toString());
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="speech.${chosenFormat}"`,
  );
  return res.status(200).send(buffer);
}
