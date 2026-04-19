import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTranscriptionRequest,
  hasValidAudioContentLength,
} from "../koala/api/transcribe-helpers.ts";
import { parseCreatePageRoute } from "../koala/create-page-query.ts";
import {
  resolveGuestCallCompletion,
  resolveGuestCallProgressStatus,
} from "../koala/language-exchange/guest-call-status.ts";
import {
  REQUESTED_RETENTION_DEFAULT,
  REQUESTED_RETENTION_MAX,
  REQUESTED_RETENTION_MIN,
  clampRequestedRetention,
  resolveRequestedRetention,
} from "../koala/settings/requested-retention.ts";

test("requested retention clamps values and defaults invalid input", () => {
  assert.equal(
    clampRequestedRetention(REQUESTED_RETENTION_MIN - 0.2),
    REQUESTED_RETENTION_MIN,
  );
  assert.equal(
    clampRequestedRetention(REQUESTED_RETENTION_MAX + 0.2),
    REQUESTED_RETENTION_MAX,
  );
  assert.equal(clampRequestedRetention(0.8), 0.8);

  assert.equal(
    resolveRequestedRetention(undefined),
    REQUESTED_RETENTION_DEFAULT,
  );
  assert.equal(
    resolveRequestedRetention(Number.NaN),
    REQUESTED_RETENTION_DEFAULT,
  );
  assert.equal(
    resolveRequestedRetention(REQUESTED_RETENTION_MIN - 0.2),
    REQUESTED_RETENTION_MIN,
  );
  assert.equal(
    resolveRequestedRetention(REQUESTED_RETENTION_MAX + 0.2),
    REQUESTED_RETENTION_MAX,
  );
  assert.equal(resolveRequestedRetention(0.8), 0.8);
});

test("parseCreatePageRoute uses the first query values and ignores invalid deck ids", () => {
  const parsed = parseCreatePageRoute(
    {
      mode: ["wordlist", "csv"],
      deckId: ["nope", "2"],
      words: [encodeURIComponent(" apple , banana ")],
    },
    [{ id: 2, name: "Beta", langCode: "ja" }],
  );

  assert.deepEqual(parsed, {
    mode: "wordlist",
    selectedDeck: null,
    words: ["apple", "banana"],
  });
});

test("transcribe helpers accept unknown content length and omit empty prompts", () => {
  assert.equal(hasValidAudioContentLength(Number.NaN, 20), true);
  assert.deepEqual(
    buildTranscriptionRequest({
      file: "blob",
      language: "ko",
      prompt: null,
    }),
    {
      file: "blob",
      model: "gpt-4o-mini-transcribe",
      language: "ko",
    },
  );
});

test("guest call helpers cover ringing peers and remaining terminal states", () => {
  assert.equal(
    resolveGuestCallProgressStatus({
      status: "RINGING",
      connectionState: "connecting",
      hasPeer: true,
    }),
    "연결 중...",
  );
  assert.equal(
    resolveGuestCallProgressStatus({
      status: "RINGING",
      connectionState: "connected",
      hasPeer: true,
    }),
    null,
  );

  assert.deepEqual(resolveGuestCallCompletion("EXPIRED"), {
    notification: {
      title: "응답이 없습니다",
      message: "학습자가 통화에 응답하지 않았습니다.",
      color: "gray",
    },
    playHangupTone: true,
  });
  assert.deepEqual(resolveGuestCallCompletion("ENDED"), {
    notification: {
      title: "통화가 종료되었습니다",
      message: "학습자가 통화를 종료했습니다.",
      color: "gray",
    },
    playHangupTone: true,
  });
});
