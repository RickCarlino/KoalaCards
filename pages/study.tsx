import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid, Header } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import * as React from "react";
import Authed from "./_authed";
import { Quiz, newQuizState, quizReducer } from "./_study_reducer";

type Props = { quizzes: Quiz[] };

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
  const [state, dispatch] = React.useReducer(
    quizReducer,
    newQuizState({ quizzes }),
  );
  const performExam = trpc.performExam.useMutation();
  const failPhrase = trpc.failPhrase.useMutation();
  const flagPhrase = trpc.flagPhrase.useMutation();

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
          {state.pendingQuizzes ? "🔄" : "☑️"}Study
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
    const cleanData = (i: (typeof data)[number]): Quiz => {
      if (i) {
        const { dictation, speaking, listening } = i.audio;
        if (typeof dictation === "string") {
          if (typeof speaking === "string") {
            if (typeof listening === "string") {
              return {
                ...i,
                audio: {
                  dictation,
                  speaking,
                  listening,
                },
              };
            }
          }
        }
      }
      throw new Error("Impossible");
    };
    return <Study quizzes={data.map(cleanData)} />;
  } else {
    return <div>Loading...</div>;
  }
}

export default function Main() {
  return Authed(<StudyLoader />);
}
