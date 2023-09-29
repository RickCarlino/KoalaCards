import MicrophonePermissions from "@/components/microphone-permissions";
import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid, Header, Paper } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useEffect, useReducer, useState } from "react";
import Authed from "../components/authed";
import {
  CurrentQuiz,
  Quiz,
  currentQuiz,
  newQuizState,
  quizReducer,
} from "./_study_reducer";

type Props = {
  quizzes: Quiz[];
  totalCards: number;
  quizzesDue: number;
  newCards: number;
};

const style = {
  background: "salmon",
  border: "1px dashed pink",
};

const HEADER_STYLES = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "20px",
};

function CardOverview({ quiz }: { quiz: CurrentQuiz }) {
  let term = "";
  let def = "";
  switch (quiz.lessonType) {
    case "dictation":
      term = quiz.ko;
      def = quiz.en;
    case "speaking":
      def = quiz.en;
  }
  return (
    <Grid grow justify="center" align="center">
      <Grid.Col span={4}>
        <Paper>{def}</Paper>
      </Grid.Col>
      <Grid.Col span={12}>
        <Paper>{term}</Paper>
      </Grid.Col>
    </Grid>
  );
}

function Failure(props: {
  id: number;
  ko: string;
  en: string;
  lessonType: string;
  userTranscription: string;
  rejectionText: string;
}) {
  return (
    <div style={style}>
      <p>You answered the last question incorrectly:</p>
      <p>Quiz type: {props.lessonType}</p>
      <p>Korean: {props.ko}</p>
      <p>English: {props.en}</p>
      <p>What you said: {props.userTranscription}</p>
      <p>Why it's wrong: {props.rejectionText}</p>
    </div>
  );
}

function Study({ quizzes, totalCards, quizzesDue, newCards }: Props) {
  const phrasesById = quizzes.reduce((acc, quiz) => {
    acc[quiz.id] = quiz;
    return acc;
  }, {} as Record<number, Quiz>);
  const newState = newQuizState({ phrasesById });
  const [state, dispatch] = useReducer(quizReducer, newState);
  const performExam = trpc.performExam.useMutation();
  const failPhrase = trpc.failPhrase.useMutation();
  const flagPhrase = trpc.flagPhrase.useMutation();
  const [failure, setFailure] = useState<{
    id: number;
    ko: string;
    en: string;
    lessonType: string;
    userTranscription: string;
    rejectionText: string;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const needBetterErrorHandler = (error: any) => {
    console.error(error);
  };
  const quiz = currentQuiz(state);
  useHotkeys([
    ["x", () => quiz && doFail(quiz.id)],
    ["z", () => quiz && doFlag(quiz.id)],
  ]);
  useEffect(() => {
    if (quiz) {
      playAudio(quiz.quizAudio);
    }
  }, [`${quiz?.id} + ${quiz?.lessonType}`]);
  if (!quiz) {
    location.reload();
    return <div>Session complete.</div>;
  }
  const { id, lessonType } = quiz;
  const onRecord = (audio: string) => {
    dispatch({ type: "WILL_GRADE", id });
    performExam
      .mutateAsync({ id, audio, lessonType })
      .then((data) => {
        setFailure(null);
        switch (data.result) {
          case "success":
            notifications.show({
              title: "Correct!",
              message: "Good job!",
              color: "green",
            });
            break;
          case "failure":
            notifications.show({
              title: "Incorrect!",
              message: "Try again!",
              color: "red",
            });
            setFailure({
              id,
              ko: quiz.ko,
              en: quiz.en,
              lessonType: quiz.lessonType,
              userTranscription: data.userTranscription,
              rejectionText: data.rejectionText,
            });
            break;
          case "error":
            notifications.show({
              title: "Error!",
              message: "Something went wrong!",
              color: "yellow",
            });
            break;
        }
        dispatch({
          type: "DID_GRADE",
          id,
          result: data.result,
        });
      })
      .catch((error) => {
        needBetterErrorHandler(error);
        dispatch({
          type: "DID_GRADE",
          id,
          result: "error",
        });
      });
  };
  const doFlag = (id: number) => {
    dispatch({ type: "USER_GAVE_UP", id });
    failPhrase.mutateAsync({ id }).catch(needBetterErrorHandler);
  };
  const doFail = (id: number) => {
    dispatch({ type: "FLAG_QUIZ", id });
    flagPhrase.mutateAsync({ id }).catch(needBetterErrorHandler);
  };

  return (
    <Container size="xs">
      <Header height={80} style={HEADER_STYLES}>
        <span style={{ fontSize: "24px", fontWeight: "bold" }}>
          {state.numQuizzesAwaitingServerResponse ? "🔄" : "☑️"}Study
        </span>
      </Header>
      <span>
        Card #{quiz.id} ({quiz.repetitions} repetitions) Due: {quizzesDue}
        New: {newCards}
        Total: {totalCards}
      </span>
      <Grid grow justify="center" align="center">
        <Grid.Col span={4}>
          <PlayButton dataURI={quiz.quizAudio} />
        </Grid.Col>
        <Grid.Col span={4}>
          <Button
            disabled={isRecording}
            onClick={() => doFlag(quiz.id)}
            fullWidth
          >
            [Z]🚩Flag Item #{quiz.id}
          </Button>
        </Grid.Col>
        <Grid.Col span={4}>
          <Button
            disabled={isRecording}
            onClick={() => doFail(quiz.id)}
            fullWidth
          >
            [X]❌Fail Item
          </Button>
        </Grid.Col>
        <Grid.Col span={4}>
          <RecordButton
            disabled={state.numQuizzesAwaitingServerResponse > 0 || isRecording}
            lessonType={quiz.lessonType}
            onStart={() => setIsRecording(true)}
            onRecord={(data) => {
              setIsRecording(false);
              onRecord(data);
            }}
          />
        </Grid.Col>
      </Grid>
      <CardOverview quiz={quiz} />
      {failure && <Failure {...failure} />}
    </Container>
  );
}

function StudyLoader() {
  const { data } = trpc.getNextQuizzes.useQuery({});
  if (data) {
    return (
      <Study
        quizzes={data.quizzes as Quiz[]}
        totalCards={data.totalCards}
        quizzesDue={data.quizzesDue}
        newCards={data.newCards}
      />
    );
  } else {
    return <div>Loading...</div>;
  }
}

export default function Main() {
  return Authed(MicrophonePermissions(<StudyLoader />));
}
