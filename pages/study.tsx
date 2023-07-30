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
  card: Quiz;
  result: "error" | "success" | "failure";
  message: string;
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
  onFlag: (card: Quiz) => void;
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
        const { card, uid } = result;
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
                {card.quizType}
              </Badge>
              <Button
                onClick={() => onFlag(card)}
                variant="link"
                color="gray"
                size="xs"
              >
                🚩
              </Button>
            </div>
            <Text size="lg" weight={500}>
              {card.ko}
            </Text>
            <Text size="sm" color="gray">
              {card.en}
            </Text>
            <Text size="sm" color="gray">
              You said: {result.message}
            </Text>
          </Card>
        );
      })}
    </div>
  );
};

interface CurrentQuizProps {
  quiz?: Quiz;
  sendAudio: (audio: string) => void;
  doFail: () => void;
  doFlag: (id?: number) => void;
}

function CurrentQuiz(props: CurrentQuizProps) {
  const { quiz, sendAudio, doFail, doFlag } = props;
  if (!quiz) {
    return (
      <Grid grow justify="center" align="center">
        <Grid.Col span={4}>
          <p>The session is over.</p>
        </Grid.Col>
        <Grid.Col span={4}>
          <Button onClick={() => location.reload()} fullWidth>
            Begin Next Session
          </Button>
        </Grid.Col>
      </Grid>
    );
  }

  return (
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
  );
}

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
    if (!quiz) return;
    setQuizResults(
      push(quizResults, {
        card: quiz,
        result: "failure",
        message: "No quiz left.",
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

  const doFlag = async (id = quiz.id) => {
    await flagPhrase.mutate({ id });
    gotoNextPhrase();
  };
  const gotoNextPhrase = async () => {
    const nextIndex = currentIndex - 1;
    setIndex(nextIndex);
    const p = quizzes[nextIndex];
    if (!p) {
      // This usually happens on
      // new accounts with < 10 cards.
      return;
    }
    await playAudio(p.quizAudio);
    return p;
  };
  const sendAudio = async (audio: string) => {
    const id = quiz.id;
    performExam
      .mutateAsync({
        id,
        audio,
        quizType: quiz.quizType,
      })
      .then(async (result) => {
        const passFail: QuizResult = {
          card: quiz,
          result: result.result,
          message: result.message,
          uid: uid(8),
        };
        setQuizResults(push(quizResults, passFail));
      });
    gotoNextPhrase();
  };
  const header = (() => {
    if (!quiz) return <span></span>;
    const difficultWord =
      quiz &&
      (quiz.win_percentage < 0.33 || quiz.total_attempts < 2) &&
      quiz.quizType !== "speaking";
    if (difficultWord) {
      return (
        <span>
          👩‍🏫 {quiz.ko} / {quiz.en}
        </span>
      );
    } else {
      return (
        <span>
          🫣 Card #{quiz.id} grade: {Math.round(quiz.win_percentage * 100)}%
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
      <CurrentQuiz
        doFail={doFail}
        sendAudio={sendAudio}
        doFlag={doFlag}
        quiz={quiz}
      />
      <QuizResultList
        results={quizResults.contents}
        onFlag={({ id }) => doFlag(id)}
      />
    </Container>
  );
}

function StudyLoader() {
  const { data } = trpc.getNextQuizzes.useQuery({});
  if (data) {
    return <Study quizzes={data} />;
  } else {
    return <div>Loading...</div>;
  }
}

export default function Main() {
  return Authed(<StudyLoader />);
}
