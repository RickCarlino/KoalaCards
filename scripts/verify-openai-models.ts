import "dotenv/config";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  OPENAI_SPEECH_MODEL,
  buildOpenAIImageRequest,
  buildOpenAIStreamingTextRequest,
  buildOpenAITextRequest,
} from "../koala/ai-openai-config";
import { buildTranscriptionRequest } from "../koala/api/transcribe-helpers";
import type { LanguageModelIdentifier } from "../koala/ai";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY");
}

const client = new OpenAI({ apiKey });
const verified: string[] = [];

async function verifyTextModel(model: LanguageModelIdentifier) {
  const response = await client.chat.completions.create(
    buildOpenAITextRequest({
      model,
      messages: [{ role: "user", content: "Reply with only OK." }],
      maxTokens: 512,
    }),
  );
  if (!response.choices[0]?.message.content) {
    throw new Error(`${model} returned no text`);
  }
  verified.push(`text:${model}`);
}

async function main() {
  await verifyTextModel("fast");
  await verifyTextModel("good");

  const structuredResponse = await client.chat.completions.parse({
    ...buildOpenAITextRequest({
      model: "cheap",
      messages: [{ role: "user", content: "Return ok as true." }],
      maxTokens: 512,
    }),
    response_format: zodResponseFormat(
      z.object({ ok: z.literal(true) }),
      "compatibility_check",
    ),
  });
  if (!structuredResponse.choices[0]?.message.parsed?.ok) {
    throw new Error("cheap returned invalid structured output");
  }
  verified.push("structured:cheap");

  const stream = await client.chat.completions.create(
    buildOpenAIStreamingTextRequest({
      model: "interactive",
      messages: [{ role: "user", content: "Reply with only OK." }],
      maxTokens: 512,
    }),
  );
  let streamedText = "";
  for await (const chunk of stream) {
    streamedText += chunk.choices[0]?.delta.content ?? "";
  }
  if (!streamedText) {
    throw new Error("interactive returned no streamed text");
  }
  verified.push("stream:interactive");

  const image = await client.images.generate(
    buildOpenAIImageRequest(
      "imageDefault",
      "A simple black circle centered on a white background.",
    ),
  );
  if (!image.data?.[0]?.b64_json) {
    throw new Error("imageDefault returned no base64 image");
  }
  verified.push("image:imageDefault");

  const speech = await client.audio.speech.create({
    model: OPENAI_SPEECH_MODEL,
    voice: "alloy",
    input: "안녕하세요.",
    response_format: "mp3",
  });
  const speechBuffer = Buffer.from(await speech.arrayBuffer());
  if (speechBuffer.length === 0) {
    throw new Error("speech returned no audio");
  }
  verified.push("speech");

  const transcription = await client.audio.transcriptions.create(
    buildTranscriptionRequest({
      file: await toFile(speechBuffer, "speech.mp3", {
        type: "audio/mpeg",
      }),
      language: "ko",
      prompt: "안녕하세요.",
    }),
  );
  if (!transcription.text) {
    throw new Error("transcription returned no text");
  }
  verified.push("transcription");

  console.log(`Verified OpenAI API contracts: ${verified.join(", ")}`);
}

void main();
