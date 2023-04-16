import { PlayButton } from "@/components/play-button";
import { useVoiceRecorder } from "@/hooks/use-recorder";
import { trpc } from "@/utils/trpc";
import * as React from "react";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
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
  if (!phrase) return <div>Loading...</div>;
  React.useEffect(() => {
    phrase &&
      phrase.id === 0 &&
      getPhrase.mutateAsync({}).then((res) => {
        setPhrase(res);
      });
  }, []);
  const [records, updateRecords] = React.useState<string[]>([]);
  const { isRecording, stop, start } = useVoiceRecorder(async (data) => {
    performExam.mutateAsync({
      id: 1,
      audio: await blobToBase64(data),
      quizType: "listening",
    });
    updateRecords([...records, window.URL.createObjectURL(data)]);
  });
  const p = JSON.stringify(phrase, null, 2);
  const speak = trpc.speak.useMutation();
  return (
    <div>
      <div>
        <pre>{p}</pre>
        <PlayButton phrase={phrase} />
        {isRecording ? <button onClick={stop}>Stop</button> : <button onClick={start}>Start</button>}
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
