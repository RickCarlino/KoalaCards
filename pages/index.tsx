import { PlayButton, createQuizText } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Center, Group } from "@mantine/core";
import * as React from "react";

const Recorder: React.FC = () => {
  const performExam = trpc.performExam.useMutation();
  const getPhrase = trpc.getNextPhrase.useMutation();
  const speak = trpc.speak.useMutation();
  type Phrase = NonNullable<typeof getPhrase["data"]>;
  const [phrase, setPhrase] = React.useState<Phrase>({
    id: 0,
    en: "Loading",
    ko: "Loading",
    win_percentage: 0,
    quizType: "dictation",
  });

  const audioPrompt = async (p: Phrase) => {
    await speak.mutateAsync({ text: createQuizText(p) });
  };
  const getNextPhrase = async () => {
    const p = await getPhrase.mutateAsync({});
    setPhrase(p);
    await audioPrompt(p);
  };
  const sendAudio = async (audio: string) => {
    const { result } = await performExam.mutateAsync({
      id: phrase.id,
      audio,
      quizType: phrase.quizType,
    });
    switch (result) {
      case "success":
        await speak.mutateAsync({ text: [{ kind: "en", value: "Pass" }] });
        return await getNextPhrase();
      case "failure":
        await speak.mutateAsync({ text: [{ kind: "en", value: "Fail" }] });
        return await audioPrompt(phrase);
      case "error":
        await speak.mutateAsync({ text: [{ kind: "en", value: "Error" }] });
        return alert(result);
    }
  };
  return (
    <Center>
      <Group>
        <Button onClick={getNextPhrase}>Next Quiz</Button>
        <PlayButton phrase={phrase} />
        <RecordButton onRecord={sendAudio} />
      </Group>
    </Center>
  );
};

export default function NavbarMinimal() {
  return (
    <div>
      <Recorder />
    </div>
  );
}
