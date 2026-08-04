import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENAI_SPEECH_MODEL,
  OPENAI_TRANSCRIPTION_MODEL,
  buildOpenAIImageRequest,
  buildOpenAIStreamingTextRequest,
  buildOpenAITextRequest,
  getOpenAITextProfile,
} from "../koala/ai-openai-config.ts";
import { buildTranscriptionRequest } from "../koala/api/transcribe-helpers.ts";

const messages = [{ role: "user" as const, content: "Test" }];

test("OpenAI text router preserves quality and latency roles", () => {
  assert.deepEqual(getOpenAITextProfile("fast"), {
    model: "gpt-5.6-terra",
    reasoningEffort: "low",
    verbosity: "low",
  });
  assert.deepEqual(getOpenAITextProfile("cheap"), {
    model: "gpt-5.6-terra",
    reasoningEffort: "medium",
  });
  assert.deepEqual(getOpenAITextProfile("good"), {
    model: "gpt-5.6-sol",
    reasoningEffort: "medium",
  });
  assert.deepEqual(getOpenAITextProfile("interactive"), {
    model: "gpt-5.6-terra",
    reasoningEffort: "low",
    verbosity: "low",
  });
});

test("OpenAI text requests include the current required model parameters", () => {
  assert.deepEqual(
    buildOpenAITextRequest({
      model: "fast",
      messages,
      maxTokens: 500,
    }),
    {
      model: "gpt-5.6-terra",
      messages,
      reasoning_effort: "low",
      verbosity: "low",
      max_completion_tokens: 500,
      stream: false,
    },
  );

  assert.deepEqual(
    buildOpenAIStreamingTextRequest({
      model: "interactive",
      messages,
    }),
    {
      model: "gpt-5.6-terra",
      messages,
      reasoning_effort: "low",
      verbosity: "low",
      stream: true,
    },
  );
});

test("OpenAI specialized requests use active quality-focused models", () => {
  assert.deepEqual(buildOpenAIImageRequest("imageDefault", "A koala"), {
    model: "gpt-image-2",
    prompt: "A koala",
    size: "1024x1024",
    quality: "high",
    output_format: "png",
    n: 1,
    stream: false,
  });
  assert.equal(OPENAI_SPEECH_MODEL, "gpt-4o-mini-tts");
  assert.equal(OPENAI_TRANSCRIPTION_MODEL, "gpt-4o-transcribe");
  assert.deepEqual(
    buildTranscriptionRequest({
      file: "audio",
      language: "ko",
      prompt: null,
    }),
    {
      file: "audio",
      model: "gpt-4o-transcribe",
      language: "ko",
      response_format: "json",
    },
  );
});
