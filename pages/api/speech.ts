import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { prismaClient } from "@/koala/prisma-client";
import { draw } from "radash";
import { stripEmojis } from "@/koala/utils/emoji";
import {
  buildSpeechInput,
  resolveSpeechContentType,
  resolveSpeechFormat,
} from "@/koala/api/speech-helpers";

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
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  const dbUser = await prismaClient.user.findUnique({ where: { email } });
  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!(await requireAuthenticatedSpeechUser(req, res))) {
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
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

  const model = "gpt-4o-mini-tts";
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
    model,
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
