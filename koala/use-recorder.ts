import { useEffect, useReducer, useRef } from "react";

type ReturnedSig = {
  recorder: MediaRecorder | null;
  start: () => Promise<void>;
  stop: () => void;
  isRecording: boolean;
  error: Error | null;
};

type State = {
  isRecording: boolean;
  recorder: MediaRecorder | null;
  data: Blob | null;
  error: Error | null;
};

type Actions =
  | { type: "start" }
  | { type: "startRecording"; payload: { recorder: MediaRecorder } }
  | { type: "stop" }
  | { type: "hasError"; payload: { error: Error | null } };

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

  // Ref for our persistent microphone stream.
  const persistentStream = useRef<MediaStream | null>(null);
  // Ref to keep track of the auto-stop timeout.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, request access to the microphone and keep the stream open.
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        persistentStream.current = stream;
      })
      .catch((error) => {
        dispatch({ type: "hasError", payload: { error } });
      });
    // On unmount, stop all audio tracks from the persistent stream.
    return () => {
      if (persistentStream.current) {
        persistentStream.current
          .getAudioTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  // Called when recording is finished; passes the resulting Blob to the callback.
  const finishRecording = ({ data }: { data: Blob }) => {
    cb(data);
  };

  const start = async () => {
    if (state.isRecording) return;
    // If the persistent stream is not available yet, request it.
    if (!persistentStream.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        persistentStream.current = stream;
      } catch (error: any) {
        dispatch({ type: "hasError", payload: { error } });
        return;
      }
    }
    dispatch({ type: "start" });
    const recorder = new MediaRecorder(persistentStream.current!);
    recorder.addEventListener("dataavailable", finishRecording);
    dispatch({ type: "startRecording", payload: { recorder } });
    recorder.start();

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
      recorder.stop();
      recorder.removeEventListener("dataavailable", finishRecording);
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
