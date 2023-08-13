import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid, Header } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import * as React from "react";
import Authed from "./_authed";

type Quiz = {
  id: number;
  ko: string;
  en: string;
  repetitions: number;
  audio: {
    // TODO: `?: string | undefined;` is not correct,
    // but Zod types seem to be returning falsey values.
    dictation?: string | undefined;
    listening?: string | undefined;
    speaking?: string | undefined;
  };
};

type CurrentQuiz = Quiz & {
  quizType: "dictation" | "listening" | "speaking";
  quizAudio: string;
};

type Props = { quizzes: Quiz[] };

const sounds = {
  failure: async () => await playAudio("/sfx/beep.mp3"),
  success: async () => await playAudio("/sfx/tada.mp3"),
  error: async () => await playAudio("/sfx/flip.wav"),
};

interface CurrentQuizProps {
  quiz?: CurrentQuiz;
  sendAudio: (audio: string) => void;
  doFail: () => void;
  doFlag: (id?: number) => void;
  inProgress: number;
}

function CurrentQuiz(props: CurrentQuizProps) {
  const { quiz, sendAudio, doFail, doFlag, inProgress } = props;
  if (!quiz) {
    let message = "";
    if (inProgress) {
      message = `Grading ${inProgress} item(s)`;
    } else {
      message = "Begin Next Session";
    }
    return (
      <Grid grow justify="center" align="center">
        <Grid.Col span={4}>
          <p>The session is over.</p>
        </Grid.Col>
        <Grid.Col span={4}>
          <Button
            disabled={!!inProgress}
            onClick={() => location.reload()}
            fullWidth
          >
            {message}
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
  const [gradingInProgress, setGradingInProgress] = React.useState(0);
  const performExam = trpc.performExam.useMutation();
  const failPhrase = trpc.failPhrase.useMutation();
  const flagPhrase = trpc.flagPhrase.useMutation();

  const getQuiz = (): CurrentQuiz => {
    const quiz = quizzes[0];
    const quizType = "dictation" as const;
    return {
      ...quiz,
      quizType,
      quizAudio: quiz.audio[quizType] ?? "",
    };
  };

  const doFail = async () => {
    const quiz = getQuiz();
    if (!quiz) return;
    await sounds.failure();
    await failPhrase.mutate({ id: getQuiz().id });
  };

  useHotkeys([
    ["f", doFail],
    ["r", () => doFlag()],
  ]);

  const doFlag = async (id = getQuiz().id) => {
    await flagPhrase.mutate({ id });
  };

  const sendAudio = async (audio: string) => {
    const id = getQuiz().id;
    setGradingInProgress((g) => g + 1);
    performExam
      .mutateAsync({
        id,
        audio,
        quizType: getQuiz().quizType,
      })
      .then(async (result) => {
        console.log("TODO: Handle quiz grade: " + JSON.stringify(result));
      })
      .finally(() => setGradingInProgress((g) => g - 1));
  };
  const header = (() => {
    const quiz = getQuiz();
    if (!quiz) return <span></span>;
    return <span>🫣 Card #{quiz.id}</span>;
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
        <span style={{ fontSize: "24px", fontWeight: "bold" }}>
          {gradingInProgress ? "🔄" : "☑️"}Study
        </span>
      </Header>
      {header}
      <CurrentQuiz
        doFail={doFail}
        sendAudio={sendAudio}
        doFlag={doFlag}
        quiz={getQuiz()}
        inProgress={gradingInProgress}
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
