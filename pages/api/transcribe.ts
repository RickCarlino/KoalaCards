import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { LANG_CODES } from "@/koala/shared-types";
import { shuffle } from "radash";
import {
  requireJsonOpenAiApiKey,
  requireJsonPostMethod,
} from "@/koala/api/next-api";
import { requireJsonApiUser } from "@/koala/get-api-user";
import {
  buildKoreanTranscriptionPrompt,
  buildTranscriptionPrompt,
  buildTranscriptionRequest,
  firstParam,
  getAudioFilename,
  hasValidAudioContentLength,
  resolveContentType,
} from "@/koala/api/transcribe-helpers";

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

function requirePostMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  return requireJsonPostMethod(req, res);
}

function requireOpenAiApiKey(res: NextApiResponse): boolean {
  return requireJsonOpenAiApiKey(res);
}

function respondPayloadTooLarge(res: NextApiResponse) {
  return res.status(413).json({
    error: `Audio payload too large. Limit is ${MAX_AUDIO_BYTES} bytes.`,
  });
}

async function requireAuthenticatedUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<boolean> {
  return Boolean(await requireJsonApiUser(req, res));
}

function parseLanguage(
  languageRaw: string | undefined,
  res: NextApiResponse,
) {
  const parsedLanguage = LANG_CODES.safeParse(languageRaw);
  if (parsedLanguage.success) {
    return parsedLanguage.data;
  }

  res.status(400).json({ error: "Missing or invalid 'language'" });
  return null;
}

async function readAudioBody(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Buffer | null> {
  try {
    return await readRawBody(req, MAX_AUDIO_BYTES);
  } catch (error: unknown) {
    if (error instanceof PayloadTooLargeError) {
      respondPayloadTooLarge(res);
      return null;
    }
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requirePostMethod(req, res)) {
    return;
  }

  const isAuthenticated = await requireAuthenticatedUser(req, res);
  if (!isAuthenticated || !requireOpenAiApiKey(res)) {
    return;
  }

  const language = parseLanguage(firstParam(req.query.language), res);
  if (!language) {
    return;
  }

  const tokens = (firstParam(req.query.hint) || "").split(/[ ,]+/);
  const hint = shuffle(tokens).join(", ").trim();
  const prompt = buildTranscriptionPrompt(hint);
  const transcriptionPrompt = buildKoreanTranscriptionPrompt(prompt);

  const contentType = resolveContentType(req.headers["content-type"]);

  const contentLength = Number(firstParam(req.headers["content-length"]));
  if (!hasValidAudioContentLength(contentLength, MAX_AUDIO_BYTES)) {
    respondPayloadTooLarge(res);
    return;
  }

  const raw = await readAudioBody(req, res);
  if (!raw) {
    return;
  }

  if (raw.length === 0) {
    return res.status(400).json({ error: "Empty audio payload" });
  }

  const filename = getAudioFilename(contentType);

  const uploadFile = await toFile(raw, filename, { type: contentType });

  const result = await openai.audio.transcriptions.create(
    buildTranscriptionRequest({
      file: uploadFile,
      language,
      prompt: transcriptionPrompt,
    }),
  );

  const text = result.text ?? "There was a transcription error.";
  console.log({
    language,
    hint,
    text,
  });
  return res.status(200).json({ text });
}
