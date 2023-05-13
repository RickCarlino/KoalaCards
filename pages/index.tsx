import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { signIn, signOut, useSession } from "next-auth/react";
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
  const performExam = trpc.performExam.useMutation();
  const getPhrase = trpc.getNextPhrase.useMutation();
  const failPhrase = trpc.failPhrase.useMutation();
  const flagPhrase = trpc.flagPhrase.useMutation();
  const speak = trpc.speak.useMutation();
  const [phrase, setPhrase] = React.useState<Phrase | null>(null);
  const [dataURI, setDataURI] = React.useState<string | null>(null);
  const { status } = useSession();
  const doFail = async () => {
    sounds.fail();
    await failPhrase.mutate({ id: phrase?.id ?? 0 });
    doSetPhrase();
  };
  const doFlag = async () => {
    await flagPhrase.mutate({ id: phrase?.id ?? 0 });
    doSetPhrase();
  };
  const sounds = {
    fail: () => playAudio("/sfx/beep.mp3"),
    success: () => playAudio("/sfx/tada.mp3"),
    error: () => playAudio("/sfx/flip.wav"),
  };
  useHotkeys([
    ["f", doFail],
    ["r", doFlag],
  ]);
  const talk = async (text: Speech) => {
    setDataURI(await speak.mutateAsync({ text }));
  };

  const doSetPhrase = async () => {
    const p = await getPhrase.mutateAsync({});
    setPhrase(p);
    talk(createQuizText(p));
    return p;
  };

  React.useEffect(() => {
    if (status === "authenticated" && !phrase) {
      doSetPhrase();
    }
  }, [status]);

  if (status === "unauthenticated")
    return <Button onClick={() => signIn()}>🔑Login</Button>;
  if (status === "loading") return <Button>🌀Authenticating...</Button>;
  if (!phrase) return <Button>📖Loading Phrase</Button>;

  const sendAudio = async (audio: string) => {
    const { result } = await performExam.mutateAsync({
      id: phrase.id,
      audio,
      quizType: phrase.quizType,
    });

    switch (result) {
      case "success":
      case "error":
        setTimeout(doSetPhrase, 1500);
        sounds[result]();
        break;
      case "failure":
        // TODO: Auto-skip to next phrase.
        // Can't do it currently because <PlayButton /> does not have an "onEnd" callback.
        sounds.fail();
        talk(createQuizText(phrase));
        break;
    }
  };

  if (!dataURI) {
    return <Button>🔊Loading Audio</Button>;
  }

  return (
    <Container size="xs">
      <Grid grow justify="center" align="center">
        <Grid.Col span={2}>
          <Button fullWidth>Button 6</Button>
        </Grid.Col>
        <Grid.Col span={2}>
          <Button onClick={() => signOut()} fullWidth>
            🚪Sign Out
          </Button>
        </Grid.Col>
        <Grid.Col span={2}>
          <PlayButton dataURI={dataURI} />
        </Grid.Col>
        <Grid.Col span={2}>
          <RecordButton quizType={phrase.quizType} onRecord={sendAudio} />
        </Grid.Col>
        <Grid.Col span={2}>
          <Button onClick={doFail} fullWidth>
            ❌[F]ail Item
          </Button>
        </Grid.Col>
        <Grid.Col span={2}>
          <Button onClick={doSetPhrase} fullWidth>
            🚩[R]eport Item #{phrase.id}
          </Button>
        </Grid.Col>
      </Grid>
    </Container>
  );
};

export default function Main() {
  return (
    <div>
      <Recorder />
    </div>
  );
}
