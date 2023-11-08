import MicrophonePermissions from "@/components/microphone-permissions";
import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid, Paper } from "@mantine/core";
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
import { QuizFailure, linkToEditPage } from "../components/quiz-failure";
import { beep } from "@/utils/beep";

type Props = {
  quizzes: Quiz[];
  totalCards: number;
  quizzesDue: number;
  newCards: number;
};

const HEADER_STYLES = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "20px",
};
const HEADER: Record<string, string> = {
  dictation: "Repeat After Me",
  speaking: "Say in Korean",
  listening: "Translate to English",
};

function CardOverview({ quiz }: { quiz: CurrentQuiz }) {
  let term = "";
  let def = "";
  switch (quiz.lessonType) {
    case "dictation":
      term = quiz.term;
      def = quiz.definition;
    case "speaking":
      def = quiz.definition;
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

function Study(props: Props) {
  const cardsById = props.quizzes.reduce(
    (acc, quiz) => {
      acc[quiz.id] = quiz;
      return acc;
    },
    {} as Record<number, Quiz>,
  );
  const newState = newQuizState({
    cardsById,
    totalCards: props.totalCards,
    quizzesDue: props.quizzesDue,
    newCards: props.newCards,
  });
  const [state, dispatch] = useReducer(quizReducer, newState);
  const performExam = trpc.performExam.useMutation();
  const failCard = trpc.failCard.useMutation();
  const flagCard = trpc.flagCard.useMutation();
  const editCard = trpc.editCard.useMutation();
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
    if (quiz && !state.failure) {
      playAudio(quiz.quizAudio);
    }
  }, [`${quiz?.id},${quiz?.lessonType},${!!state.failure}`]);

  const doFail = (id: number) => {
    dispatch({ type: "USER_GAVE_UP", id });
    failCard.mutateAsync({ id }).catch(needBetterErrorHandler);
  };

  /** goToNext flag controls if the session will skip to next
   * card or not. */
  const doFlag = (id: number, goToNext = true) => {
    goToNext && dispatch({ type: "FLAG_QUIZ", id });
    return flagCard.mutateAsync({ id }).catch(needBetterErrorHandler);
  };

  const f = state.failure;
  if (f) {
    const clear = () => dispatch({ type: "SET_FAILURE", value: null });
    const psd = f.previousSpacingData;
    const failProps: Parameters<typeof QuizFailure>[0] = {
      ...f,
      onClose: clear,
      onFlag: () => {
        doFlag(f.id, false).then(clear);
      },
    };
    if (psd) {
      failProps.onDiscard = () => {
        editCard
          .mutateAsync({
            id: f.id,
            ...psd,
          })
          .then(clear);
      };
    }
    return <QuizFailure {...failProps} />;
  }
  if (!quiz) {
    return (
      <div>
        <h1>No Cards Due</h1>
        <p>
          You must <a href="/create">create new cards</a> or{" "}
          <a href="/cards">import cards from a backup file</a>.
        </p>
      </div>
    );
  }
  const { id, lessonType } = quiz;
  const onRecord = (audio: string) => {
    dispatch({ type: "WILL_GRADE", id });
    performExam
      .mutateAsync({ id, audio, lessonType })
      .then(async (data) => {
        dispatch({ type: "SET_FAILURE", value: null });
        switch (data.result) {
          case "success":
            const g = Math.round(data.grade);
            const colors: Record<number, string> = {
              3: "#23c91a",
              4: "#1ac0c9",
              5: "#1a1ac9",
            };
            const color = colors[g] || "#c90ea7";
            const titles: Record<number, string> = {
              3: "Close Enough",
              4: "Correct!",
              5: "Perfect!",
            };
            const title = titles[g] || "OK";
            notifications.show({
              title,
              message: `Grade: ${data.grade.toPrecision(2)}/5`,
              color,
            });
            break;
          case "failure":
            await beep();
            lessonType === "speaking" &&
              console.log("Transcript: " + data.userTranscription);
            dispatch({
              type: "SET_FAILURE",
              value: {
                id,
                term: quiz.term,
                definition: quiz.definition,
                lessonType: quiz.lessonType,
                userTranscription: data.userTranscription,
                rejectionText: data.rejectionText,
                previousSpacingData: data.previousSpacingData,
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
          .mutateAsync({
            notIn: state.quizIDsForLesson,
          })
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

  return (
    <Container size="xs">
      <header style={HEADER_STYLES}>
        <span style={{ fontSize: "24px", fontWeight: "bold" }}>
          {HEADER[quiz.lessonType] || "Study"}
          {!!state.numQuizzesAwaitingServerResponse && "⏳"}
        </span>
      </header>
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
      <p>Card #{quiz.id} quiz</p>
      <p>{quiz.repetitions} repetitions</p>
      <p>{quiz.lapses} lapses</p>
      <p>
        {state.totalCards} cards total, {state.quizzesDue} due, {state.newCards}{" "}
        new.
      </p>
      <p>{linkToEditPage(quiz.id)}</p>
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
