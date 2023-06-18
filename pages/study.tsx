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
import { uid } from "radash";
import * as React from "react";
import Authed from "./_authed";

type QuizResult = {
  phrase: Quiz;
  result: "error" | "success" | "failure";
  uid: string;
};

interface CappedStack<T> {
  contents: T[];
  limit: number;
}

type Quiz = {
  id: number;
  en: string;
  ko: string;
  win_percentage: number;
  total_attempts: number;
  quizType: "dictation" | "listening" | "speaking";
  quizAudio: string;
};

type Props = {
  quizzes: Quiz[];
};

function push<T>(stack: CappedStack<T>, item: T): CappedStack<T> {
  const { contents, limit } = stack;
  const newContents = [item, ...contents].slice(0, limit);
  return { contents: newContents, limit };
}

const sounds = {
  failure: async () => await playAudio("/sfx/beep.mp3"),
  success: async () => await playAudio("/sfx/tada.mp3"),
  error: async () => await playAudio("/sfx/flip.wav"),
};

type QuizResultListProps = {
  results: QuizResult[];
  onFlag: (phrase: Quiz) => void;
};

const QuizResultList: React.FC<QuizResultListProps> = ({ results, onFlag }) => {
  return (
    <div>
      {results.map((result) => {
        let color: string;
        switch (result.result) {
          case "success":
            color = "green";
            break;
          case "failure":
            color = "red";
            break;
          case "error":
            color = "yellow";
            break;
        }
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
              <Badge variant={"filled"} color={color}>
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
          </Card>
        );
      })}
    </div>
  );
};

function Study({ quizzes }: Props) {
  const [currentIndex, setIndex] = React.useState(quizzes.length - 1);
  const quiz: Quiz | undefined = quizzes[currentIndex];
  const [quizResults, setQuizResults] = React.useState<CappedStack<QuizResult>>(
    {
      contents: [],
      limit: 5,
    }
  );

  const performExam = trpc.performExam.useMutation();
  const failPhrase = trpc.failPhrase.useMutation();
  const flagPhrase = trpc.flagPhrase.useMutation();

  const doFail = async () => {
    setQuizResults(
      push(quizResults, {
        phrase: quiz,
        result: "failure",
        uid: uid(8),
      })
    );
    await sounds.failure();
    await failPhrase.mutate({ id: quiz.id });
    gotoNextPhrase();
  };

  useHotkeys([
    ["f", doFail],
    ["r", () => doFlag()],
  ]);

  if (!quiz) {
    return <div>Done!</div>;
  }

  const doFlag = async (id = quiz.id) => {
    await flagPhrase.mutate({ id });
    gotoNextPhrase();
  };
  const gotoNextPhrase = async () => {
    const nextIndex = currentIndex - 1;
    setIndex(nextIndex);
    const p = quizzes[nextIndex];
    await playAudio(p.quizAudio);
    return p;
  };
  const sendAudio = async (audio: string) => {
    const { result } = await performExam.mutateAsync({
      id: quiz.id,
      audio,
      quizType: quiz.quizType,
    });
    const passFail = { phrase: quiz, result, uid: uid(8) };
    setQuizResults(push(quizResults, passFail));
    await sounds[result]();
    gotoNextPhrase();
  };
  const difficultWord = (quiz.win_percentage < 0.33 || quiz.total_attempts < 2) && quiz.quizType !== "speaking";
  const header = (() => {
    if (difficultWord) {
      return (
        <span>
          👩‍🏫 {quiz.ko} / {quiz.en}
        </span>
      );
    } else {
      return (
        <span>
          🫣 Phrase #{quiz.id} grade: {Math.round(quiz.win_percentage * 100)}%
        </span>
      );
    }
  })();
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
        <span style={{ fontSize: "24px", fontWeight: "bold" }}>Study</span>
      </Header>
      {header}
      <Grid grow justify="center" align="center">
        <Grid.Col span={4}>
          <PlayButton dataURI={quiz.quizAudio} />
        </Grid.Col>
        <Grid.Col span={4}>
          <RecordButton quizType={quiz.quizType} onRecord={sendAudio} />
        </Grid.Col>
        <Grid.Col span={4}>
          <Button onClick={doFail} fullWidth>
            ❌[F]ail Item
          </Button>
        </Grid.Col>
        <Grid.Col span={4}>
          <Button onClick={() => doFlag(quiz.id)} fullWidth>
            🚩Flag Item[R] #{quiz.id}
          </Button>
        </Grid.Col>
      </Grid>
      <QuizResultList
        results={quizResults.contents}
        onFlag={({ id }) => doFlag(id)}
      />
    </Container>
  );
}

function StudyLoader() {
  const { data } = trpc.getNextQuizzes.useQuery({});
  // HACK: Browsers will not auto-play audio if you have
  // not interacted with the page. This is a hack to get
  // around that.
  const [didClick, doClick] = React.useState(false);
  if (data) {
    if (!didClick) {
      return <Button onClick={() => doClick(true)}>Start</Button>;
    }
    return <Study quizzes={data} />;
  } else {
    return <div>Loading...</div>;
  }
}

export default function Main() {
  return Authed(<StudyLoader />);
}
