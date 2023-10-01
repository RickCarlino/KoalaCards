import MicrophonePermissions from "@/components/microphone-permissions";
import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid, Header, Paper } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useEffect, useReducer } from "react";
import Authed from "../components/authed";
import {
  CurrentQuiz,
  Quiz,
  currentQuiz,
  newQuizState,
  quizReducer,
} from "../utils/_study_reducer";

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

function Study(props: Props) {
  const phrasesById = props.quizzes.reduce(
    (acc, quiz) => {
      acc[quiz.id] = quiz;
      return acc;
    },
    {} as Record<number, Quiz>,
  );
  const newState = newQuizState({
    phrasesById,
    totalCards: props.totalCards,
    quizzesDue: props.quizzesDue,
    newCards: props.newCards,
  });
  const [state, dispatch] = useReducer(quizReducer, newState);
  const performExam = trpc.performExam.useMutation();
  const failPhrase = trpc.failPhrase.useMutation();
  const flagPhrase = trpc.flagPhrase.useMutation();
  const getNextQuiz = trpc.getNextQuiz.useMutation();
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
    return (
      <div>
        <h1>Session Complete.</h1>
        {state.failure && <Failure {...state.failure} />}
      </div>
    );
  }
  const { id, lessonType } = quiz;
  const onRecord = (audio: string) => {
    dispatch({ type: "WILL_GRADE", id });
    performExam
      .mutateAsync({ id, audio, lessonType })
      .then((data) => {
        dispatch({ type: "SET_FAILURE", value: null });
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
            dispatch({
              type: "SET_FAILURE",
              value: {
                id,
                ko: quiz.ko,
                en: quiz.en,
                lessonType: quiz.lessonType,
                userTranscription: data.userTranscription,
                rejectionText: data.rejectionText,
              },
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
      })
      .finally(() => {
        getNextQuiz
          .mutateAsync({})
          .catch(needBetterErrorHandler)
          .then((data) => {
            if (!data) return;
            dispatch({
              type: "ADD_MORE",
              quizzes: data.quizzes,
              totalCards: data.totalCards,
              quizzesDue: data.quizzesDue,
              newCards: data.newCards,
            });
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
          Study{!!state.numQuizzesAwaitingServerResponse && "⏳"}
        </span>
      </Header>
      <Grid grow justify="center" align="center">
        <Grid.Col span={4}>
          <PlayButton dataURI={quiz.quizAudio} />
        </Grid.Col>
        <Grid.Col span={4}>
          <Button
            disabled={state.isRecording}
            onClick={() => doFlag(quiz.id)}
            fullWidth
          >
            [Z]🚩Flag Item #{quiz.id}
          </Button>
        </Grid.Col>
        <Grid.Col span={4}>
          <Button
            disabled={state.isRecording}
            onClick={() => doFail(quiz.id)}
            fullWidth
          >
            [X]❌Fail Item
          </Button>
        </Grid.Col>
        <Grid.Col span={4}>
          <RecordButton
            disabled={
              state.numQuizzesAwaitingServerResponse > 0 || state.isRecording
            }
            lessonType={quiz.lessonType}
            onStart={() => dispatch({ type: "SET_RECORDING", value: true })}
            onRecord={(data) => {
              dispatch({ type: "SET_RECORDING", value: false });
              onRecord(data);
            }}
          />
        </Grid.Col>
      </Grid>
      <CardOverview quiz={quiz} />
      <p>
        {quiz.lessonType.toUpperCase()} quiz for Card #{quiz.id} (
        {quiz.repetitions} repetitions)
      </p>
      <p>
        {state.totalCards} cards total, {state.quizzesDue} due, {state.newCards}{" "}
        new.
      </p>
      {state.failure && <Failure {...state.failure} />}
    </Container>
  );
}

function StudyLoader() {
  const { data, failureReason } = trpc.getNextQuizzes.useQuery({});
  if (failureReason) {
    return <div>Failed to load: {failureReason.message}</div>;
  }
  if (data) {
    return (
      <Study
        quizzes={data.quizzes}
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
