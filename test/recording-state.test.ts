import test from "node:test";
import assert from "node:assert/strict";
import {
  isRecordingAvailable,
  shouldHandleRecordingHotkey,
} from "../koala/review/recording-state.ts";

const availability = (
  overrides: Partial<Parameters<typeof isRecordingAvailable>[0]> = {},
) =>
  isRecordingAvailable({
    explicitlyDisabled: false,
    isAudioPlaying: false,
    isRecording: false,
    responsePhase: "ready",
    ...overrides,
  });

test("recording can start only while the current card awaits an answer", () => {
  assert.equal(availability(), true);
  assert.equal(availability({ responsePhase: "processing" }), false);
  assert.equal(availability({ responsePhase: "failure" }), false);
  assert.equal(availability({ responsePhase: "success" }), false);
});

test("recording cannot start over prompt or correction audio", () => {
  assert.equal(availability({ isAudioPlaying: true }), false);
  assert.equal(availability({ explicitlyDisabled: true }), false);
});

test("an active recording can always be stopped", () => {
  assert.equal(
    availability({
      explicitlyDisabled: true,
      isAudioPlaying: true,
      isRecording: true,
      responsePhase: "processing",
    }),
    true,
  );
});

test("held recording hotkeys do not toggle the recorder repeatedly", () => {
  assert.equal(shouldHandleRecordingHotkey(false), true);
  assert.equal(shouldHandleRecordingHotkey(true), false);
});
