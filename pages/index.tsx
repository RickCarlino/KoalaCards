import { PlayButton } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Center, Group } from "@mantine/core";
import * as React from "react";
type Mutation = ReturnType<typeof trpc.speak.useMutation>["mutateAsync"];
type Speech = Parameters<Mutation>[0]["text"];
type Phrase = NonNullable<
  ReturnType<typeof trpc.getNextPhrase.useMutation>["data"]
>;
export const createQuizText = (phrase: Phrase) => {
  let text: Speech = [
    { kind: "ko", value: phrase?.ko ?? "" },
    { kind: "pause", value: 500 },
    { kind: "en", value: phrase?.en ?? "" },
  ];
  switch (phrase.quizType) {
    case "dictation":
      text = [
        { kind: "en", value: "Repeat after me: " },
        { kind: "pause", value: 250 },
        { kind: "ko", value: phrase.ko },
        { kind: "pause", value: 250 },
        { kind: "slow", value: phrase.ko },
      ];
      break;
    case "listening":
      text = [
        { kind: "en", value: "Say this in English: " },
        { kind: "pause", value: 250 },
        { kind: "ko", value: phrase.ko },
      ];
      break;
    case "speaking":
      text = [
        { kind: "en", value: "Say this in Korean: " },
        { kind: "pause", value: 250 },
        { kind: "en", value: phrase.en },
      ];
      break;
  }
  return text;
};

const Recorder: React.FC = () => {
  type Phrase = NonNullable<(typeof getPhrase)["data"]>;
  const performExam = trpc.performExam.useMutation();
  const getPhrase = trpc.getNextPhrase.useMutation();
  const speak = trpc.speak.useMutation();
  const [phrase, setPhrase] = React.useState<Phrase>();
  const [dataURI, setDataURI] = React.useState("");

  const x = async (text: JSONSpeech) => {
    ({
      text: [
        { kind: 'en', value: 'Say this in Korean: ' },
        { kind: 'pause', value: 250 },
        { kind: 'en', value: "It's every two days." }
      ]
    })
    setDataURI(await speak.mutateAsync(text));
  };

  const doSetPhrase = async () => {
    const p = await getPhrase.mutateAsync({});
    setPhrase(p);
    if (!dataURI) {
      x({ text: createQuizText(p) });
    }
    return p;
  };

  React.useEffect(() => {
    !phrase && doSetPhrase();
  }, []);

  if (!phrase) {
  
    return <div>Loading Phrase</div>;
  }

  type JSONSpeech = Parameters<typeof speak.mutateAsync>[0];

  const audioPrompt = async (p: Phrase) => {
    await x({ text: createQuizText(p) });
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
        await x({ text: [{ kind: "en", value: "Pass" }] });
        return await getNextPhrase();
      case "failure":
        await x({ text: [{ kind: "en", value: "Fail" }] });
        return await audioPrompt(phrase);
      case "error":
        await x({ text: [{ kind: "en", value: "Error" }] });
        return alert(result);
    }
  };

  if (!dataURI) {
    return <div>Loading Audio</div>;
  }

  return (
    <div>
      <Center>
        <h1>Card #{phrase.id}</h1>{" "}
        <Group>
          <PlayButton dataURI={dataURI} />
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
