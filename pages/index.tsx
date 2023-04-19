import { PlayButton } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import * as React from "react";

const Recorder: React.FC = () => {
  const performExam = trpc.performExam.useMutation();
  const getPhrase = trpc.getNextPhrase.useMutation();
  type Phrase = NonNullable<typeof getPhrase["data"]>;
  const [phrase, setPhrase] = React.useState<Phrase>({
    id: 0,
    en: "Loading",
    ko: "Loading",
    win_percentage: 0,
    quizType: "dictation",
  });
  if (!phrase) return <div>Loading...</div>;
  React.useEffect(() => {
    phrase.id === 0 &&
      getPhrase.mutateAsync({}).then((res) => {
        setPhrase(res);
      });
  }, []);
  const sendAudio = (audio: string) => {
    performExam.mutateAsync({
      id: phrase.id,
      audio,
      quizType: phrase.quizType,
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
