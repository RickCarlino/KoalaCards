import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecorderOptions,
  canStartSpeechRecording,
  recordingStartErrorMessage,
} from "../koala/writing/recording-state.ts";
import {
  resolveGuestCallCompletion,
  resolveGuestCallProgressStatus,
} from "../koala/language-exchange/guest-call-status.ts";
import {
  resolveWritingPracticeRedirect,
  shouldRedirectFromReviewPage,
} from "../koala/review/server-side.ts";

test("canStartSpeechRecording enforces busy and recorder guards", () => {
  assert.equal(
    canStartSpeechRecording({
      isSupported: true,
      disabled: false,
      isTranscribing: false,
      isStarting: false,
      hasRecorder: false,
      startInFlight: false,
      stopInFlight: false,
    }),
    true,
  );

  assert.equal(
    canStartSpeechRecording({
      isSupported: true,
      disabled: false,
      isTranscribing: false,
      isStarting: false,
      hasRecorder: true,
      startInFlight: false,
      stopInFlight: false,
    }),
    false,
  );
});

test("buildRecorderOptions includes mime type only when present", () => {
  assert.deepEqual(buildRecorderOptions("audio/webm"), {
    mimeType: "audio/webm",
    audioBitsPerSecond: 16_000,
  });
  assert.deepEqual(buildRecorderOptions(null), {
    audioBitsPerSecond: 16_000,
  });
});

test("recordingStartErrorMessage normalizes unknown errors", () => {
  assert.equal(
    recordingStartErrorMessage(new Error("Permission denied")),
    "Permission denied",
  );
  assert.equal(
    recordingStartErrorMessage("unexpected"),
    "Unable to access microphone.",
  );
});

test("resolveGuestCallProgressStatus reflects connection state", () => {
  assert.equal(
    resolveGuestCallProgressStatus({
      status: "RINGING",
      connectionState: null,
      hasPeer: false,
    }),
    "연결 준비 중...",
  );
  assert.equal(
    resolveGuestCallProgressStatus({
      status: "ACTIVE",
      connectionState: "connecting",
      hasPeer: true,
    }),
    "연결 중...",
  );
  assert.equal(
    resolveGuestCallProgressStatus({
      status: "ACTIVE",
      connectionState: "connected",
      hasPeer: true,
    }),
    null,
  );
});

test("resolveGuestCallCompletion maps terminal statuses", () => {
  assert.deepEqual(resolveGuestCallCompletion("DECLINED"), {
    notification: {
      title: "통화가 거절되었습니다",
      message: "학습자가 지금은 통화를 받을 수 없습니다.",
      color: "gray",
    },
    playHangupTone: true,
  });
  assert.deepEqual(resolveGuestCallCompletion("CANCELLED"), {
    notification: null,
    playHangupTone: true,
  });
  assert.equal(resolveGuestCallCompletion("ACTIVE"), null);
});

test("review server-side helpers return the expected redirects", () => {
  assert.equal(
    shouldRedirectFromReviewPage({ hasDue: false, canStartNew: false }),
    true,
  );
  assert.equal(
    shouldRedirectFromReviewPage({ hasDue: true, canStartNew: false }),
    false,
  );
  assert.equal(
    resolveWritingPracticeRedirect({
      writingFirst: true,
      progress: 75,
      goal: 100,
      deckId: 12,
      buildReviewPath: (deckId) => `/review/${deckId}`,
      buildWritingPracticeUrl: (returnTo) =>
        `/writing/practice?returnTo=${returnTo}`,
    }),
    "/writing/practice?returnTo=/review/12",
  );
  assert.equal(
    resolveWritingPracticeRedirect({
      writingFirst: false,
      progress: 0,
      goal: 100,
      deckId: 12,
      buildReviewPath: (deckId) => `/review/${deckId}`,
      buildWritingPracticeUrl: (returnTo) =>
        `/writing/practice?returnTo=${returnTo}`,
    }),
    null,
  );
});
