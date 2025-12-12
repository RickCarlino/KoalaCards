import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { LANG_CODES } from "@/koala/shared-types";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { prismaClient } from "@/koala/prisma-client";
import { shuffle } from "radash";

export const config = {
  api: { bodyParser: false },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

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

  const languageRaw = firstParam(req.query.language);
  const parsedLanguage = LANG_CODES.safeParse(languageRaw);
  if (!parsedLanguage.success) {
    return res
      .status(400)
      .json({ error: "Missing or invalid 'language'" });
  }
  const language = parsedLanguage.data;

  const tokens = (firstParam(req.query.hint) || "").split(/[ ,]+/);
  const hint = shuffle(tokens).join(", ").trim();

  const contentType =
    (req.headers["content-type"] as string | undefined) ??
    "application/octet-stream";

  const raw = await readRawBody(req);
  if (raw.length === 0) {
    return res.status(400).json({ error: "Empty audio payload" });
  }

  const filename = /mp4|mpeg/.test(contentType)
    ? "recording.mp4"
    : "recording.webm";

  const uploadFile = await toFile(raw, filename, { type: contentType });

  const result = await openai.audio.transcriptions.create({
    file: uploadFile,
    model: "gpt-4o-mini-transcribe",
    language,
    ...(hint ? { prompt: `Might contain words like ${hint}` } : {}),
  });

  const text = result.text ?? "There was a transcription error.";
  return res.status(200).json({ text });
}
