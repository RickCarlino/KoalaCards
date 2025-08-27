import { useReducer, useRef } from "react";

// Cross-browser preferred MIME selection for MediaRecorder
function getPreferredAudioMime(): string | undefined {
  const candidates = [
    // Prefer MP4 so Safari selects it
    "audio/mp4",
    // Chrome/Edge modern
    "audio/webm;codecs=opus",
    "audio/webm",
    // Fallbacks
    "audio/mpeg",
  ];
  const isTypeSupported = (type: string) =>
    typeof (window as any).MediaRecorder !== "undefined" &&
    (window as any).MediaRecorder.isTypeSupported?.(type);
  for (const type of candidates) {
    try {
      if (isTypeSupported(type)) return type;
    } catch (_) {
      // ignore
    }
  }
  return undefined;
}

type ReturnedSig = {
  recorder: MediaRecorder | null;
  start: () => Promise<void>;
  stop: () => void;
  isRecording: boolean;
  error: unknown;
};

type State = {
  isRecording: boolean;
  recorder: MediaRecorder | null;
  data: Blob | null;
  error: unknown;
};

type Actions =
  | { type: "start" }
  | { type: "startRecording"; payload: { recorder: MediaRecorder } }
  | { type: "stop" }
  | { type: "hasError"; payload: { error: unknown } };

const initState: State = {
  isRecording: false,
  recorder: null,
  data: null,
  error: null,
};

const reducer = (state: State, action: Actions): State => {
  switch (action.type) {
    case "start":
      return { ...state, isRecording: true };
    case "stop":
      return { ...state, isRecording: false };
    case "startRecording":
      return {
        ...state,
        isRecording: true,
        recorder: action.payload.recorder,
      };
    case "hasError":
      return { ...state, isRecording: false, error: action.payload.error };
    default:
      return state;
  }
};

export const useVoiceRecorder = (
  cb: (result: Blob) => void,
): ReturnedSig => {
  const [state, dispatch] = useReducer(reducer, initState);

  // Ref for our persistent microphone stream (created on user gesture).
  const persistentStream = useRef<MediaStream | null>(null);
  // Ref to keep track of the auto-stop timeout.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Record the mime we chose so we can stamp the resulting Blob correctly.
  const chosenMimeRef = useRef<string | undefined>(undefined);
  // Guard to avoid double-callbacks from browsers that emit multiple dataavailable events.
  const deliveredRef = useRef<boolean>(false);

  // Accumulate chunks and deliver final blob on stop
  const chunksRef = useRef<BlobPart[]>([]);
  const onDataAvailable = ({ data }: { data: Blob }) => {
    if (data && data.size > 0) {
      chunksRef.current.push(data);
    }
  };
  const onStop = () => {
    const raw = (chosenMimeRef.current || "audio/mp4").toString();
    const container = raw.split(";")[0];
    const normalized =
      container === "audio/webm" ||
      container === "audio/mp4" ||
      container === "audio/mpeg"
        ? container
        : "audio/mp4";
    const finalBlob = new Blob(chunksRef.current, { type: normalized });
    chunksRef.current = [];
    cb(finalBlob);
  };

  const start = async () => {
    if (state.isRecording) {
      return;
    }
    // Request microphone stream on-demand (user gesture context).
    try {
      if (!persistentStream.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        persistentStream.current = stream;
      }
    } catch (error: unknown) {
      dispatch({ type: "hasError", payload: { error } });
      return;
    }
    dispatch({ type: "start" });

    // Pick a stable MIME for the current browser (important for iOS Safari)
    const preferredMime = getPreferredAudioMime();
    chosenMimeRef.current = preferredMime;

    const recorder = preferredMime
      ? new MediaRecorder(persistentStream.current!, {
          mimeType: preferredMime,
        })
      : new MediaRecorder(persistentStream.current!);
    chunksRef.current = [];
    recorder.addEventListener("dataavailable", onDataAvailable);
    recorder.addEventListener("stop", onStop);
    dispatch({ type: "startRecording", payload: { recorder } });
    recorder.start();
    deliveredRef.current = false;
    // Set an auto-stop timer to stop recording after 20 seconds.
    timeoutRef.current = setTimeout(() => {
      stop();
    }, 20000);

    // Clear any previous error.
    if (state.error) {
      dispatch({ type: "hasError", payload: { error: null } });
    }
  };

  const stop = () => {
    const recorder = state.recorder;
    dispatch({ type: "stop" });
    // Clear the auto-stop timer if it exists.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recorder) {
      try {
        // Ask for final data chunk before stopping (Safari reliability)
        recorder.requestData?.();
      } catch (_) {}
      recorder.stop();
      recorder.removeEventListener("dataavailable", onDataAvailable);
      recorder.removeEventListener("stop", onStop);
      // NOTE: We do not stop the stream’s audio tracks here so that the mic remains active.
    }
  };

  return {
    start,
    stop,
    recorder: state.recorder,
    isRecording: state.isRecording,
    error: state.error,
  };
};
