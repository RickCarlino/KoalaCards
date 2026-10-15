import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENAI_SPEECH_MODEL,
  OPENAI_TRANSCRIPTION_MODEL,
  buildOpenAIImageRequest,
  buildOpenAIStreamingTextRequest,
  buildOpenAITextRequest,
  buildOpenAIChoiceRequest,
  buildOpenAIResponseRequest,
  getOpenAITextProfile,
} from "../koala/ai-openai-config.ts";
import { buildTranscriptionRequest } from "../koala/api/transcribe-helpers.ts";

const messages = [{ role: "user" as const, content: "Test" }];

test("review decisions use the dedicated endpoint contract without generation settings", () => {
  const options = {
    input: "untrusted answer",
    instructions: "Select a bucket",
    choices: [
      { value: "correct", description: "Right" },
      { value: "incorrect", description: "Wrong" },
    ],
  };
  assert.deepEqual(buildOpenAIChoiceRequest(options), {
    model: "gpt-6-luna",
    input: options.input,
    questions: [
      {
        type: "choice",
        name: "classification",
        instructions: options.instructions,
        choices: options.choices,
      },
    ],
  });
});

test("review explanations use Responses settings and do not store provider state", () => {
  assert.deepEqual(
    buildOpenAIResponseRequest({
      model: "explanation",
      messages,
      maxTokens: 2500,
    }),
    {
      model: "gpt-6.1-sol",
      store: false,
      input: messages,
      reasoning: { effort: "medium" },
      text: { verbosity: "low" },
      max_output_tokens: 2500,
    },
  );
});

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

test("review explanations use GPT-6.1 Sol without changing other model roles", () => {
  assert.deepEqual(getOpenAITextProfile("explanation"), {
    model: "gpt-6.1-sol",
    reasoningEffort: "medium",
    verbosity: "low",
  });
  assert.equal(
    buildOpenAITextRequest({ model: "explanation", messages }).model,
    "gpt-6.1-sol",
  );
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
