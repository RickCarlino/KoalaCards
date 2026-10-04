export type RecordingResponsePhase =
  "ready" | "processing" | "success" | "failure";

type RecordingAvailability = {
  explicitlyDisabled: boolean;
  isAudioPlaying: boolean;
  isRecording: boolean;
  responsePhase: RecordingResponsePhase;
};

export function isRecordingAvailable({
  explicitlyDisabled,
  isAudioPlaying,
  isRecording,
  responsePhase,
}: RecordingAvailability): boolean {
  if (isRecording) {
    return true;
  }
  return (
    !explicitlyDisabled && !isAudioPlaying && responsePhase === "ready"
  );
}

export function shouldHandleRecordingHotkey(isRepeat: boolean): boolean {
  return !isRepeat;
}
