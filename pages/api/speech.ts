import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { prismaClient } from "@/koala/prisma-client";
import { draw } from "radash";
import { stripEmojis } from "@/koala/utils/emoji";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type SpeechBody = {
  tl?: string;
  en?: string;
  format?: "wav" | "mp3" | "opus";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const dbUser = await prismaClient.user.findUnique({ where: { email } });
  if (!dbUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  const { tl, en, format } = (req.body ?? {}) as SpeechBody;
  const tlText = (tl ?? "").toString();
  const enText = (en ?? "").toString();
  const cleanTlText = stripEmojis(tlText);
  const cleanEnText = stripEmojis(enText);
  if (!cleanTlText.trim()) {
    return res.status(400).json({ error: "Missing 'tl'" });
  }
  const input = cleanEnText.trim()
    ? `${cleanTlText}\n${cleanEnText}`
    : cleanTlText;

  const model = "gpt-4o-mini-tts-2025-12-15";
  const VOICES = [
    "alloy",
    "ash",
    "ballad",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
  ] as const;
  const chosenFormat: NonNullable<SpeechBody["format"]> = format || "mp3";

  const speech = await openai.audio.speech.create({
    model,
    voice: draw(VOICES) || VOICES[0],
    input,
    response_format: chosenFormat,
  });

  const arrayBuffer = await speech.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentTypeMap: Record<
    NonNullable<SpeechBody["format"]>,
    string
  > = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    opus: "audio/ogg",
  };
  const contentType = contentTypeMap[chosenFormat] ?? "audio/wav";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", buffer.length.toString());
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="speech.${chosenFormat}"`,
  );
  return res.status(200).send(buffer);
}
