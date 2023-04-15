import { trpc } from "@/utils/trpc";
import * as React from "react";
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
      dispatch({ type: "startRecording", payload: { recorder } });
      recorder.start();
      recorder.addEventListener("dataavailable", finishRecording);
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

function blobToBase64(blob: Blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

const Recorder: React.FC = () => {
  const performExam = trpc.performExam.useMutation();
  const getPhrase = trpc.getNextPhrase.useMutation();
  const [phrase, setPhrase] = React.useState<typeof getPhrase["data"]>({
    id: 0,
    en: "Loading",
    ko: "Loading",
    win_percentage: 0,
  });
  React.useEffect(() => {
    phrase && phrase.id === 0 && getPhrase.mutateAsync({}).then((res) => {
      setPhrase(res);
    });
  }, []);
  const [records, updateRecords] = React.useState<string[]>([]);
  const { isRecording, stop, start } = useVoiceRecorder(async (data) => {
    performExam.mutateAsync({ audio: await blobToBase64(data), phraseID: 1 });
    updateRecords([...records, window.URL.createObjectURL(data)]);
  });
  const p = JSON.stringify(phrase, null, 2);
  return (
    <div>
      <div>
        <pre>
          { p }
        </pre>
        <h3>Mic is {isRecording ? "on" : "off"}</h3>
        <button onClick={() => {
          getPhrase.mutateAsync({}).then((res) => {
            setPhrase(res);
          });
        }}>Get Phrase</button>
        <button onClick={start}>Start</button>
        <button onClick={stop}>Stop</button>
      </div>
      <div>
        <h1>Records:</h1>
        {records.map((data, idx) => (
          <div key={idx}>
            <audio src={data} controls preload={"metadata"} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default function NavbarMinimal() {
  return (
    <div>
      <Recorder />
    </div>
  );
}
