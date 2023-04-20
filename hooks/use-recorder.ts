import { useReducer } from "react";

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
      return { ...state, isRecording: true, recorder: action.payload.recorder };
    case "hasError":
      return { ...state, isRecording: false, error: action.payload.error };
    default:
      return state;
  }
};

export const useVoiceRecorder = (cb: (result: Blob) => void): ReturnedSig => {
  const [state, dispatch] = useReducer(reducer, initState);

  const finishRecording = ({ data }: { data: Blob }) => {
    cb(data);
  };

  const start = async () => {
    try {
      if (state.isRecording) return;
      dispatch({ type: "start" });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.addEventListener("dataavailable", finishRecording);
      dispatch({ type: "startRecording", payload: { recorder } });
      recorder.start();
      if (state.error) dispatch({ type: "hasError", payload: { error: null } });
    } catch (err) {
      dispatch({ type: "hasError", payload: { error: err } } as any);
    }
  };

  const stop = () => {
    try {
      const recorder = state.recorder;
      dispatch({ type: "stop" });
      if (recorder) {
        if (recorder.state !== "inactive") recorder.stop();
        recorder.removeEventListener("dataavailable", finishRecording);
      }
    } catch (err) {
      dispatch({ type: "hasError", payload: { error: err } } as any);
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
