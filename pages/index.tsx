import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Grid } from "@mantine/core";
import * as React from "react";
import { useSession, signIn, signOut } from "next-auth/react";

type Mutation = ReturnType<typeof trpc.speak.useMutation>["mutateAsync"];
type Speech = Parameters<Mutation>[0]["text"];
type Phrase = NonNullable<
  ReturnType<typeof trpc.getNextPhrase.useMutation>["data"]
>;

export const sayTheAnswer = (phrase: Phrase): Speech => {
  switch (phrase.quizType) {
    case "dictation":
    case "speaking":
      return [
        { kind: "ko", value: phrase.ko },
        { kind: "pause", value: 250 },
        { kind: "en", value: phrase.en },
      ];
    case "listening":
      return [
        { kind: "en", value: phrase.en },
        { kind: "pause", value: 250 },
        { kind: "ko", value: phrase.ko },
      ];
  }
};

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
  const failSound = () => playAudio("/sfx/beep.mp3");
  const okSound = () => playAudio("/sfx/tada.mp3");
  const errorSound = () => playAudio("/sfx/flip.wav");
  const { status } = useSession();

  const talk = async (text: Speech) => {
    setDataURI(await speak.mutateAsync({ text }));
  }

  const doSetPhrase = async () => {
    const p = await getPhrase.mutateAsync({});
    setPhrase(p);
    talk(createQuizText(p));
    return p;
  };

  React.useEffect(() => {
    status === "authenticated" && !phrase && doSetPhrase();
  }, [status]);

  if (status === "unauthenticated") {
    return <Button onClick={() => signIn()}>🔑Login</Button>;
  }

  if (status === "loading") {
    return <Button>🌀Authenticating...</Button>;
  }

  if (!phrase) {
    return <Button>📖Loading Phrase</Button>;
  }

  const sendAudio = async (audio: string) => {
    const { result } = await performExam.mutateAsync({
      id: phrase.id,
      audio,
      quizType: phrase.quizType,
    });
    /* Set 1500 ms pause so that experience is less intense to user. */
    switch (result) {
      case "success":
        setTimeout(doSetPhrase, 1500);
        return await okSound();
      case "failure":
        // TODO: Auto-skip to next phrase.
        // Can't do it currently because
        // <PlayButton /> does not have an "onEnd" callback.
        await failSound();
        await talk(sayTheAnswer(phrase));
        return;
      case "error":
        setTimeout(doSetPhrase, 1500);
        return await errorSound();
    }
  };

  if (!dataURI) {
    return <Button>🔊Loading Audio</Button>;
  }

  return (
    <Grid grow justify="center" align="center">
      <Grid.Col span={2}>
        <Button onClick={() => signOut()}>🚪Sign Out</Button>
      </Grid.Col>
      <Grid.Col span={2}>
        <Button onClick={() => {
          // TODO: Create a "flag" field on phrases and update
          // the backend query to exclude flagged phrases.
          doSetPhrase();
        }}>🚩Flag Item #{phrase.id}</Button>
      </Grid.Col>
      <Grid.Col span={2}>
        <PlayButton dataURI={dataURI} />
      </Grid.Col>
      <Grid.Col span={2}>
        <RecordButton quizType={phrase.quizType} onRecord={sendAudio} />
      </Grid.Col>
      <Grid.Col span={2}></Grid.Col>
      <Grid.Col span={2}></Grid.Col>
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
