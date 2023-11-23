import MicrophonePermissions from "@/components/microphone-permissions";
import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid, Paper } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useEffect, useState, useReducer } from "react";
import Authed from "../components/authed";
import {
  CurrentQuiz,
  Quiz,
  currentQuiz,
  newQuizState,
  quizReducer,
} from "../utils/_study_reducer";
import { QuizFailure, linkToEditPage } from "../components/quiz-failure";
import Link from "next/link";
import { useUserSettings } from "@/components/settings-provider";

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
  const settings = useUserSettings();
  const newState = newQuizState({
    cardsById,
    totalCards: props.totalCards,
    quizzesDue: props.quizzesDue,
    newCards: props.newCards,
    listeningPercentage: settings.listeningPercentage,
  });
  const [state, dispatch] = useReducer(quizReducer, newState);
  const performExam = trpc.performExam.useMutation();
  const failCard = trpc.failCard.useMutation();
  const flagCard = trpc.flagCard.useMutation();
  const editCard = trpc.editCard.useMutation();
  const getNextQuiz = trpc.getNextQuiz.useMutation();
  // TODO: Move into state tree.
  const [isOK, setOK] = useState(true);
  const needBetterErrorHandler = (error: any) => {
    notifications.show({
      title: "Error!",
      message: "Unexpected error or timeout.",
      color: "yellow",
    });
    console.error(error);
  };
  const quiz = currentQuiz(state);
  useHotkeys([
    ["x", () => quiz && doFail(quiz.id)],
    ["z", () => quiz && doFlag(quiz.id)],
  ]);
  const noFailures = state.failures.length === 0;
  const deps = [quiz?.id, quiz?.lessonType, noFailures];
  const linterRequiresThis = deps.join(".");
  useEffect(() => {
    if (quiz && noFailures) {
      setOK(false);
      playAudio(quiz.quizAudio);
    }
  }, [linterRequiresThis]);

  const doFail = (id: number) => {
    dispatch({ type: "USER_GAVE_UP", id });
    setOK(true);
    failCard.mutateAsync({ id }).catch(needBetterErrorHandler);
  };

  /** goToNext flag controls if the session will skip to next
   * card or not. */
  const doFlag = (id: number, goToNext = true) => {
    goToNext && dispatch({ type: "FLAG_QUIZ", id });
    setOK(true);
    return flagCard.mutateAsync({ id }).catch(needBetterErrorHandler);
  };

  const f = state.failures[0];
  if (f && !state.isRecording && isOK) {
    const clear = () =>
      dispatch({
        type: "REMOVE_FAILURE",
        id: f.id,
      });
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
  // Loading message if quizzesDue > 0
  if (!quiz && state.quizzesDue > 0) {
    return (
      <div>
        <h1>Please Wait</h1>
        <p>Loading more cards...</p>
      </div>
    );
  }
  if (!quiz) {
    return (
      <div>
        <h1>No Cards Due</h1>
        <p>You can:</p>
        <ul>
          <li>
            <Link href="/user">
              Increase max cards per day (current value:{" "}
              {settings.cardsPerDayMax})
            </Link>
          </li>
          <li>
            <Link href="/create">Create new cards</Link>.
          </li>
          <li>
            <Link href="/cards">Import cards from a backup file</Link>
          </li>
        </ul>
      </div>
    );
  }
  const { id, lessonType } = quiz;
  const processAudio = (audio: string) => {
    dispatch({ type: "SET_RECORDING", value: false });
    dispatch({ type: "WILL_GRADE", id });
    setOK(true);
    performExam
      .mutateAsync({ id, audio, lessonType })
      .then(async (data) => {
        // Why did I add this? TODO: Remove after lots of testing...
        dispatch({ type: "REMOVE_FAILURE", id: quiz.id });
        if (data.result === "failure") {
          console.log("Transcript: " + data.userTranscription);
          dispatch({
            type: "ADD_FAILURE",
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
              quizzes: data.quizzes.map((x) => {
                return {
                  ...x,
                  randomSeed: Math.random(),
                };
              }),
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
            disabled={state.isRecording}
            lessonType={quiz.lessonType}
            onStart={() => dispatch({ type: "SET_RECORDING", value: true })}
            onRecord={processAudio}
          />
        </Grid.Col>
      </Grid>
      <CardOverview quiz={quiz} />
      <p>Card #{quiz.id} quiz</p>
      <p>{quiz.repetitions} repetitions</p>
      <p>{quiz.lapses} lapses</p>
      <p>
        {state.totalCards} cards total, {state.quizzesDue} due, {state.newCards}{" "}
        new, {state.numQuizzesAwaitingServerResponse} awaiting grades,{" "}
        {Object.keys(state.cardsById).length} in study Queue,
        {state.failures.length} in failure queue.
      </p>
      <p>{linkToEditPage(quiz.id)}</p>
    </Container>
  );
}

function StudyLoader() {
  const { data, failureReason } = trpc.getNextQuizzes.useQuery({});

  if (!data) {
    return <div>Loading data...</div>;
  }

  if (failureReason) {
    return <div>Failed to load: {failureReason.message}</div>;
  }

  return (
    <Study
      quizzes={data.quizzes.map((x) => {
        return {
          ...x,
          randomSeed: Math.random(),
        };
      })}
      totalCards={data.totalCards}
      quizzesDue={data.quizzesDue}
      newCards={data.newCards}
    />
  );
}

export default function Main() {
  return Authed(MicrophonePermissions(<StudyLoader />));
}
