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
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

class PayloadTooLargeError extends Error {
  constructor() {
    super("Audio payload too large");
    this.name = "PayloadTooLargeError";
  }
}

async function readRawBody(
  req: NextApiRequest,
  maxBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    const onData = (chunk: Buffer | string) => {
      const bufferChunk = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);
      totalBytes += bufferChunk.length;

      if (totalBytes > maxBytes) {
        fail(new PayloadTooLargeError());
        req.destroy();
        return;
      }

      chunks.push(bufferChunk);
    };

    const onEnd = () => finish();

    const onError = (error: Error) => fail(error);

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
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

  const contentLength = Number(firstParam(req.headers["content-length"]));
  if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES) {
    return res.status(413).json({
      error: `Audio payload too large. Limit is ${MAX_AUDIO_BYTES} bytes.`,
    });
  }

  let raw: Buffer;
  try {
    raw = await readRawBody(req, MAX_AUDIO_BYTES);
  } catch (error: unknown) {
    if (error instanceof PayloadTooLargeError) {
      return res.status(413).json({
        error: `Audio payload too large. Limit is ${MAX_AUDIO_BYTES} bytes.`,
      });
    }
    throw error;
  }

  if (raw.length === 0) {
    return res.status(400).json({ error: "Empty audio payload" });
  }

  const filename = /mp4|mpeg/.test(contentType)
    ? "recording.mp4"
    : "recording.webm";

  const uploadFile = await toFile(raw, filename, { type: contentType });

  const result = await openai.audio.transcriptions.create({
    file: uploadFile,
    model: "gpt-4o-mini-transcribe-2025-12-15",
    language,
    ...(hint ? { prompt: `Might contain words like ${hint}` } : {}),
  });

  const text = result.text ?? "There was a transcription error.";
  console.log({
    language,
    hint,
    text,
  });
  return res.status(200).json({ text });
}
