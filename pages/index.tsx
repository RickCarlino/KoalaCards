import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import {
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Header,
  Text,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { signIn, signOut, useSession } from "next-auth/react";
import { uid } from "radash";
import * as React from "react";

type QuizResult = {
  phrase: Phrase;
  pass: boolean;
  // Can't use "id" as a React `key` prop because it's not unique
  // across all quiz attempts (you can quiz on things twice).
  uid: string;
};

type QuizResultListProps = {
  results: QuizResult[];
  onFlag: (phrase: Phrase) => void;
};

const QuizResultList: React.FC<QuizResultListProps> = ({ results, onFlag }) => {
  return (
    <div>
      {results.map((result) => {
        const { phrase, uid } = result;
        return (
          <Card
            key={uid}
            shadow="xs"
            padding="md"
            radius="sm"
            style={{ marginBottom: "10px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "5px",
              }}
            >
              <Badge
                variant={result.pass ? "outline" : "filled"}
                color={result.pass ? "green" : "red"}
              >
                {phrase.quizType}
              </Badge>
              <Button
                onClick={() => onFlag(phrase)}
                variant="link"
                color="gray"
                size="xs"
              >
                🚩
              </Button>
            </div>
            <Text size="lg" weight={500}>
              {phrase.ko}
            </Text>
            <Text size="sm" color="gray">
              {phrase.en}
            </Text>
            <Text size="sm" style={{ marginTop: "10px" }}>
              {result.pass ? "Pass" : "Fail"}
            </Text>
          </Card>
        );
      })}
    </div>
  );
};

interface CappedStack<T> {
  contents: T[];
  limit: number;
}

function push<T>(stack: CappedStack<T>, item: T): CappedStack<T> {
  const { contents, limit } = stack;
  const newContents = [item, ...contents].slice(0, limit);
  return { contents: newContents, limit };
}

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
  const [quizResults, setQuizResults] = React.useState<CappedStack<QuizResult>>(
    {
      contents: [],
      limit: 5,
    }
  );
  const { status } = useSession();
  const doFail = async () => {
    phrase &&
      setQuizResults(
        push(quizResults, {
          phrase,
          pass: true,
          uid: uid(8),
        })
      );
    sounds.fail();
    await failPhrase.mutate({ id: phrase?.id ?? 0 });
    doSetPhrase();
  };
  const doFlag = async (id = phrase?.id ?? 0) => {
    await flagPhrase.mutate({ id });
    doSetPhrase();
  };
  const sounds = {
    fail: () => playAudio("/sfx/beep.mp3"),
    success: () => playAudio("/sfx/tada.mp3"),
    error: () => playAudio("/sfx/flip.wav"),
  };
  useHotkeys([
    ["f", doFail],
    ["r", () => doFlag()],
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
    const passFail = {
      phrase,
      pass: true,
      uid: uid(8),
    };
    switch (result) {
      case "success":
      case "error":
        setQuizResults(push(quizResults, passFail));
        setTimeout(doSetPhrase, 1500);
        sounds[result]();
        break;
      case "failure":
        passFail.pass = false;
        setQuizResults(push(quizResults, passFail));
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
      <Header
        height={80}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <span style={{ fontSize: "24px", marginRight: "10px" }}>
          <span role="img" aria-label="Koala">
            🐨
          </span>
        </span>
        <span style={{ fontSize: "24px", fontWeight: "bold" }}>KoalaSRS</span>
      </Header>
      <Grid grow justify="center" align="center">
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
      <QuizResultList
        results={quizResults.contents}
        onFlag={({ id }) => doFlag(id)}
      />
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
