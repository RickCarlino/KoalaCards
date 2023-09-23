import { PlayButton } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid, Header, Paper } from "@mantine/core";
import { useEffect, useReducer, useState } from "react";
import Authed from "./_authed";
import {
  Quiz,
  CurrentQuiz,
  newQuizState,
  quizReducer,
  currentQuiz,
} from "./_study_reducer";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

type Props = {
  quizzes: Quiz[];
  totalCards: number;
  quizzesDue: number;
  newCards: number;
};

interface CurrentQuizProps {
  quiz: CurrentQuiz;
  inProgress: number;
  doFail: (id: string) => void;
  doFlag: (id: string) => void;
  onRecord: (audio: string) => void;
}

function CurrentQuiz(props: CurrentQuizProps) {
  const { quiz, onRecord, doFail, doFlag, inProgress } = props;
  const [isRecording, setIsRecording] = useState(false);
  useHotkeys([
    ["x", () => doFail("" + quiz.id)],
    ["z", () => doFlag("" + quiz.id)],
  ]);
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
        <RecordButton
          disabled={!!props.inProgress}
          lessonType={quiz.lessonType}
          onStart={() => {
            setIsRecording(true);
          }}
          onRecord={(data) => {
            setIsRecording(false);
            onRecord(data);
          }}
        />
      </Grid.Col>
      <Grid.Col span={4}>
        <Button
          disabled={isRecording}
          onClick={() => doFail("" + quiz.id)}
          fullWidth
        >
          [X]❌Fail Item
        </Button>
      </Grid.Col>
      <Grid.Col span={4}>
        <Button
          disabled={isRecording}
          onClick={() => doFlag("" + quiz.id)}
          fullWidth
        >
          [Z]🚩Flag Item #{quiz.id}
        </Button>
      </Grid.Col>
    </Grid>
  );
}

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
  const style = {
    background: "salmon",
    border: "1px dashed pink",
  };
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
  const needBetterErrorHandler = (error: any) => {
    console.error(error);
    dispatch({ type: "ADD_ERROR", message: JSON.stringify(error) });
  };
  const quiz = currentQuiz(state);
  if (!quiz) {
    location.reload();
    return <div>Session complete.</div>;
  }
  const header = (() => {
    if (!quiz) return <span></span>;
    let message = "";
    if (quizzesDue > 100) {
      message = `🔥 ${quizzesDue}/${totalCards} cards due!`;
    } else {
      message = `Due: ${quizzesDue} New: ${newCards} Total: ${totalCards}`;
    }
    return (
      <span>
        🫣 Card #{quiz.id}, {quiz.repetitions} repetitions. {message}
      </span>
    );
  })();

  return (
    <Container size="xs">
      {state.errors.length ? "ERROR DETECTED!?!?!" : ""}
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
          {state.numQuizzesAwaitingServerResponse ? "🔄" : "☑️"}Study
        </span>
      </Header>
      {header}
      <CurrentQuiz
        doFail={(id) => {
          dispatch({ type: "FAIL_QUIZ", id });
          failPhrase
            .mutateAsync({ id: parseInt(id, 10) })
            .catch(needBetterErrorHandler);
        }}
        onRecord={(audio) => {
          const { id, lessonType } = quiz;
          dispatch({ type: "WILL_GRADE" });
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
              dispatch({ type: "DID_GRADE", id: "" + id, result: data.result });
            })
            .catch((error) => {
              needBetterErrorHandler(error);
              dispatch({ type: "DID_GRADE", id: "" + id, result: "error" });
            });
        }}
        doFlag={(id) => {
          dispatch({ type: "FLAG_QUIZ", id });
          flagPhrase
            .mutateAsync({ id: parseInt(id, 10) })
            .catch(needBetterErrorHandler);
        }}
        quiz={quiz}
        inProgress={state.numQuizzesAwaitingServerResponse}
      />
      <CardOverview quiz={quiz} />
      {failure ? <Failure {...failure} /> : null}
    </Container>
  );
}

function StudyLoader() {
  const [isReady, setReady] = useState(false);
  useEffect(() => {
    // Request microphone permission
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((_stream) => setReady(true));
  }, []);
  const { data } = trpc.getNextQuizzes.useQuery({});
  if (!isReady) {
    return <div>Requesting microphone permission...</div>;
  }
  if (data) {
    const cleanData = (i: (typeof data.quizzes)[number]): Quiz => {
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
    return (
      <Study
        quizzes={data.quizzes.map(cleanData)}
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
  return Authed(<StudyLoader />);
}
