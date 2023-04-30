import { PlayButton, createPlayer } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Grid } from "@mantine/core";
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
  const [failSound] = createPlayer("/sfx/beep.mp3");
  const [okSound] = createPlayer("/sfx/tada.mp3");
  const [errorSound] = createPlayer("/sfx/flip.wav");

  const doSetPhrase = async () => {
    const p = await getPhrase.mutateAsync({});
    setPhrase(p);
    setDataURI(await speak.mutateAsync({ text: createQuizText(p) }));
    return p;
  };

  React.useEffect(() => {
    !phrase && doSetPhrase();
  }, []);

  if (!phrase) {
    return <div>Loading Phrase</div>;
  }

  const sendAudio = async (audio: string) => {
    const { result } = await performExam.mutateAsync({
      id: phrase.id,
      audio,
      quizType: phrase.quizType,
    });
    /* Set 1500 ms pause so that experience is less intense to user. */
    setTimeout(doSetPhrase, 1500);
    switch (result) {
      case "success":
        return okSound();
      case "failure":
        return failSound();
      case "error":
        return errorSound();
    }
  };

  if (!dataURI) {
    return <div>Loading Audio</div>;
  }

  return (
    <Grid grow justify="center" align="center">
      <Grid.Col span={3}>
        <Button onClick={() => alert("TODO")}>🚩Flag Item #{phrase.id}</Button>
      </Grid.Col>
      <Grid.Col span={3}>
        <PlayButton dataURI={dataURI} />
      </Grid.Col>
      <Grid.Col span={3}>
        <RecordButton quizType={phrase.quizType} onRecord={sendAudio} />
      </Grid.Col>
    </Grid>
  );
};

export default function Main() {
  return (
    <div>
      <Recorder />
    </div>
  );
}
