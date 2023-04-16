import { PlayButton } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import * as React from "react";

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
  const sendAudio = (audio: string) => {
    performExam.mutateAsync({
      id: 1,
      audio,
      quizType: "listening",
    });
  };
  return (
    <div>
      <pre>{JSON.stringify(phrase, null, 2)}</pre>
      <div>
        <PlayButton phrase={phrase} />
        <RecordButton onRecord={sendAudio} />
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
