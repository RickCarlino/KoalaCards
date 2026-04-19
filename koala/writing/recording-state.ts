export type RecordingStartState = {
  isSupported: boolean;
  disabled: boolean;
  isTranscribing: boolean;
  isStarting: boolean;
  hasRecorder: boolean;
  startInFlight: boolean;
  stopInFlight: boolean;
};

export type RecorderOptionsLike = {
  audioBitsPerSecond: number;
  mimeType?: string;
};

export function canStartSpeechRecording(
  state: RecordingStartState,
): boolean {
  if (
    !state.isSupported ||
    state.disabled ||
    state.isTranscribing ||
    state.isStarting
  ) {
    return false;
  }

  return !state.hasRecorder && !state.startInFlight && !state.stopInFlight;
}

export function buildRecorderOptions(
  preferredMimeType: string | null,
): RecorderOptionsLike {
  if (preferredMimeType) {
    return {
      mimeType: preferredMimeType,
      audioBitsPerSecond: 16_000,
    };
  }

  return {
    audioBitsPerSecond: 16_000,
  };
}

export function recordingStartErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to access microphone.";
}
