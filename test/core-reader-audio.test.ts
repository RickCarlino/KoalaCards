import test from "node:test";
import assert from "node:assert/strict";
import { State } from "ts-fsrs";
import { isPrivateOrLocalIp } from "../koala/reader/article.ts";
import { selectOccurrenceIndex } from "../koala/reader/highlight-context.ts";
import { toFsrsCardInput } from "../koala/trpc-routes/calculate-scheduling-data.ts";
import {
  buildSpeechInput,
  resolveSpeechContentType,
  resolveSpeechFormat,
} from "../koala/api/speech-helpers.ts";
import {
  buildTranscriptionRequest,
  buildTranscriptionPrompt,
  firstParam,
  getAudioFilename,
  hasValidAudioContentLength,
  resolveContentType,
} from "../koala/api/transcribe-helpers.ts";

test("isPrivateOrLocalIp identifies private and public addresses", () => {
  assert.equal(isPrivateOrLocalIp("127.0.0.1"), true);
  assert.equal(isPrivateOrLocalIp("::1"), true);
  assert.equal(isPrivateOrLocalIp("::ffff:192.168.0.1"), true);
  assert.equal(isPrivateOrLocalIp("8.8.8.8"), false);
});

test("selectOccurrenceIndex prefers the best contextual match", () => {
  const occurrences = [
    {
      index: 0,
      startOffset: 0,
      endOffset: 4,
      before: "prefix",
      match: "word",
      after: "other",
    },
    {
      index: 1,
      startOffset: 10,
      endOffset: 14,
      before: "best prefix",
      match: "word",
      after: "best suffix",
    },
  ];

  assert.equal(
    selectOccurrenceIndex({
      occurrences,
      contextBefore: "best prefix",
      contextAfter: "best suffix",
      occurrenceHint: 0,
    }),
    1,
  );
});

test("selectOccurrenceIndex falls back to a valid hint when scores tie at zero", () => {
  const occurrences = [
    {
      index: 0,
      startOffset: 0,
      endOffset: 4,
      before: "alpha",
      match: "word",
      after: "beta",
    },
    {
      index: 1,
      startOffset: 10,
      endOffset: 14,
      before: "gamma",
      match: "word",
      after: "delta",
    },
  ];

  assert.equal(
    selectOccurrenceIndex({
      occurrences,
      contextBefore: "",
      contextAfter: "",
      occurrenceHint: 1,
    }),
    1,
  );
});

test("toFsrsCardInput normalizes review stats and derives review state", () => {
  const now = Date.now();
  const lastReview = now - 2 * 24 * 60 * 60 * 1000;
  const nextReview = now + 24 * 60 * 60 * 1000;

  const card = toFsrsCardInput(
    {
      difficulty: 5,
      stability: 8,
      lastReview,
      nextReview,
      lapses: -2,
      repetitions: 3.7,
    },
    now,
  );

  assert.equal(card.state, State.Review);
  assert.equal(card.lapses, 0);
  assert.equal(card.reps, 3);
  assert.equal(card.due, nextReview);
  assert.equal(card.last_review, lastReview);
  assert.ok(card.elapsed_days > 1.9);
  assert.ok(card.scheduled_days > 0.9);
});

test("speech helpers compose input and resolve formats", () => {
  assert.equal(
    buildSpeechInput(" 안녕하세요 ", " Hello "),
    "안녕하세요\nHello",
  );
  assert.equal(buildSpeechInput(" 안녕하세요 ", " "), "안녕하세요");
  assert.equal(buildSpeechInput("   ", "Hello"), null);
  assert.equal(resolveSpeechFormat(undefined), "mp3");
  assert.equal(resolveSpeechContentType("opus"), "audio/ogg");
});

test("transcribe helpers normalize headers and prompt text", () => {
  assert.equal(firstParam(["a", "b"]), "a");
  assert.equal(resolveContentType(undefined), "application/octet-stream");
  assert.equal(hasValidAudioContentLength(10, 20), true);
  assert.equal(hasValidAudioContentLength(30, 20), false);
  assert.equal(getAudioFilename("audio/mp4"), "recording.mp4");
  assert.equal(getAudioFilename("audio/webm"), "recording.webm");
  assert.equal(
    buildTranscriptionPrompt("단어, 예문"),
    "Might contain words like 단어, 예문",
  );
  assert.equal(buildTranscriptionPrompt(""), null);
  assert.deepEqual(
    buildTranscriptionRequest({
      file: "blob",
      language: "ko",
      prompt: "Might contain words like 단어",
    }),
    {
      file: "blob",
      model: "gpt-4o-mini-transcribe",
      language: "ko",
      prompt: "Might contain words like 단어",
    },
  );
});
