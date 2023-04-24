import { PlayButton, createQuizText } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Center, Group } from "@mantine/core";
import * as React from "react";

const Recorder: React.FC = () => {
  type Phrase = NonNullable<(typeof getPhrase)["data"]>;
  const performExam = trpc.performExam.useMutation();
  const getPhrase = trpc.getNextPhrase.useMutation();
  const speak = trpc.speak.useMutation();
  const [phrase, setPhrase] = React.useState<Phrase>({
    id: 0,
    en: "Loading",
    ko: "Loading",
    win_percentage: 0,
    quizType: "dictation",
  });

  React.useEffect(() => {
    phrase.id === 0 && doSetPhrase();
  }, []);

  const doSetPhrase = async () => {
    const p = await getPhrase.mutateAsync({});
    setPhrase(p);
    return p;
  };
  type JSONSpeech = Parameters<typeof speak.mutateAsync>[0];
  const sayIt = async (text: JSONSpeech) => {
    const dataURI = await speak.mutateAsync(text);
  };
  const audioPrompt = async (p: Phrase) => {
    await sayIt({ text: createQuizText(p) });
  };

  const getNextPhrase = async () => {
    await audioPrompt(await doSetPhrase());
  };

  const sendAudio = async (audio: string) => {
    const { result } = await performExam.mutateAsync({
      id: phrase.id,
      audio,
      quizType: phrase.quizType,
    });
    switch (result) {
      case "success":
        await sayIt({ text: [{ kind: "en", value: "Pass" }] });
        return await getNextPhrase();
      case "failure":
        await sayIt({ text: [{ kind: "en", value: "Fail" }] });
        return await audioPrompt(phrase);
      case "error":
        await sayIt({ text: [{ kind: "en", value: "Error" }] });
        return alert(result);
    }
  };
  return (
    <div>
      <Center>
        <h1>Card #{phrase.id}</h1>{" "}
        <Group>
          <PlayButton phrase={phrase} />
          <RecordButton onRecord={sendAudio} />
        </Group>
      </Center>
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
