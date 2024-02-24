import MicrophonePermissions from "@/components/microphone-permissions";
import { playAudio } from "@/components/play-button";
import { QuizFailure, linkToEditPage } from "@/components/quiz-failure";
import { blobToBase64, convertBlobToWav } from "@/components/record-button";
import { useUserSettings } from "@/components/settings-provider";
import {
  Action,
  Failure,
  Quiz,
  State,
  gotoNextQuiz,
  newQuizState,
  quizReducer,
} from "@/utils/study_reducer";
import { trpc } from "@/utils/trpc";
import { useVoiceRecorder } from "@/utils/use-recorder";
import { Button, Container, Grid } from "@mantine/core";
import { Grade } from "femto-fsrs";
import Link from "next/link";
import { Dispatch, useEffect, useReducer, useState } from "react";

type MutationData = ReturnType<typeof trpc.getNextQuizzes.useMutation>;
type QuizData = NonNullable<MutationData["data"]>;
type QuizViewProps = {
  quiz: Quiz;
  awaitingGrades: number;
  newCards: number;
  queueSize: number;
  quizzesDue: number;
  totalCards: number;
  pendingFailures: number;
  isRecording: boolean;
  playQuizAudio: () => Promise<void>;
  flagQuiz: (goToNext: boolean) => Promise<void>;
  startRecording(grade: Grade): Promise<void>;
  stopRecording: () => Promise<void>;
};

const HEADER_STYLES = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "20px",
};

const HEADER: Record<string, string> = {
  speaking: "Say in target language",
  listening: "Translate to English",
};

function StudyHeader({ lessonType }: { lessonType: keyof typeof HEADER }) {
  return (
    <header style={HEADER_STYLES}>
      <span style={{ fontSize: "24px", fontWeight: "bold" }}>
        {HEADER[lessonType] || "Study"}
      </span>
    </header>
  );
}

const currentQuiz = (state: State) => {
  const curr = state.currentItem;
  if (curr.type !== "quiz") {
    return;
  }
  return curr.value;
};

type QuizAssertion = (q: Quiz | undefined) => asserts q is Quiz;
const assertQuiz: QuizAssertion = (q) => {
  if (!q) {
    throw new Error("No quiz found");
  }
};

function useBusinessLogic(state: State, dispatch: Dispatch<Action>) {
  const flagCard = trpc.flagCard.useMutation();
  const performExam = trpc.gradeQuiz.useMutation();
  const getNextQuiz = trpc.getNextQuizzes.useMutation();
  const manuallyGade = trpc.manuallyGrade.useMutation();
  const userSettings = useUserSettings();
  const [perceivedDifficulty, setGrade] = useState(Grade.GOOD);
  const quiz = currentQuiz(state);

  const onRecord = async (audio: string) => {
    assertQuiz(quiz);
    const id = quiz.quizId;
    dispatch({ type: "END_RECORDING", id: quiz.quizId });
    performExam
      .mutateAsync({ id, audio, perceivedDifficulty })
      .then(async (data) => {
        if (data.result === "fail") {
          console.log("Transcript: " + data.userTranscription);
          dispatch({
            type: "ADD_FAILURE",
            value: {
              id,
              cardId: quiz.cardId,
              term: quiz.term,
              definition: quiz.definition,
              lessonType: quiz.lessonType,
              userTranscription: data.userTranscription,
              rejectionText: data.rejectionText,
              rollbackData: data.rollbackData,
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
        console.error("Error grading quiz", error);
        dispatch({
          type: "DID_GRADE",
          id,
          result: "error",
        });
      })
      .finally(() => {
        getNextQuiz
          .mutateAsync({
            notIn: [
              ...state.quizIDsForLesson,
              ...state.idsAwaitingGrades,
              ...state.idsWithErrors,
            ],
          })
          .then((data) => {
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
  const { stop, start } = useVoiceRecorder(async (data) => {
    assertQuiz(quiz);
    const wav = await convertBlobToWav(data);
    const b64 = await blobToBase64(wav);
    if (quiz.lessonType !== "listening") {
      if (Math.random() < userSettings.playbackPercentage) {
        await playAudio(b64);
      }
    }
    onRecord(b64);
  });

  return {
    async playQuizAudio() {
      assertQuiz(quiz);
      await playAudio(quiz.audio);
    },
    async flagQuiz(_: boolean) {
      if (!confirm("This will pause reviews. Are you sure?")) {
        return;
      }
      const curr = state.currentItem;
      let id = 0;
      switch (curr.type) {
        case "quiz":
          id = curr.value.quizId;
          break;
        case "failure":
          id = curr.value.id;
          break;
      }
      dispatch({ type: "FLAG_QUIZ", cardId: id });
      await flagCard.mutateAsync({ id: id });
    },
    async stopRecording() {
      stop();
    },
    async startRecording(perceivedDifficulty: Grade) {
      assertQuiz(quiz);
      const id = quiz.quizId;
      if (perceivedDifficulty === Grade.AGAIN) {
        dispatch({ type: "USER_GAVE_UP", id });
        manuallyGade.mutateAsync({
          id,
          grade: Grade.AGAIN,
        });
        return;
      } else {
        setGrade(perceivedDifficulty);
        dispatch({ type: "BEGIN_RECORDING" });
        start();
      }
    },
  };
}

function useQuizState(props: QuizData) {
  const cardsById = props.quizzes.reduce((acc, quiz) => {
    acc[quiz.quizId] = quiz;
    return acc;
  }, {} as Record<number, Quiz>);
  const newState = gotoNextQuiz(
    newQuizState({
      cardsById,
      totalCards: props.totalCards,
      quizzesDue: props.quizzesDue,
      newCards: props.newCards,
    }),
  );
  const [state, dispatch] = useReducer(quizReducer, newState);
  // Include other state-related logic here, such as useEffects, and return necessary data and functions
  return {
    ...useBusinessLogic(state, dispatch),
    state,
    dispatch,
  };
}

function NoQuizDue(_: {}) {
  const settings = useUserSettings();

  return (
    <div>
      <h1>No Cards Due</h1>
      <p>You can:</p>
      <ul>
        <li>
          <Link href="/user">
            Increase max cards per day (current value: {settings.cardsPerDayMax}
            )
          </Link>
        </li>
        <li>
          <Link href="/create">Create new cards</Link>.
        </li>
        <li>
          <Link href="/cards">Import cards from a backup file</Link>
        </li>
        <li>Refresh this page to load more.</li>
      </ul>
    </div>
  );
}

function QuizView(props: QuizViewProps) {
  const { quiz } = props;
  const GRID_SIZE = 2;
  useEffect(() => {
    props.playQuizAudio();
  }, [props.quiz.quizId]);
  let buttonCluster = (
    <Grid grow justify="center" align="stretch" gutter="xs">
      <Grid.Col span={6}>
        <Button fullWidth onClick={props.playQuizAudio}>
          Play Audio
        </Button>
      </Grid.Col>
      <Grid.Col span={6}>
        <Button fullWidth onClick={() => props.flagQuiz(true)}>
          Pause Reviews
        </Button>
      </Grid.Col>
      <Grid.Col span={GRID_SIZE}>
        <Button fullWidth onClick={() => props.startRecording(Grade.AGAIN)}>
          Fail
        </Button>
      </Grid.Col>
      <Grid.Col span={GRID_SIZE}>
        <Button fullWidth onClick={() => props.startRecording(Grade.HARD)}>
          Hard
        </Button>
      </Grid.Col>
      <Grid.Col span={GRID_SIZE}>
        <Button fullWidth onClick={() => props.startRecording(Grade.GOOD)}>
          Good
        </Button>
      </Grid.Col>
      <Grid.Col span={GRID_SIZE}>
        <Button fullWidth onClick={() => props.startRecording(Grade.EASY)}>
          Easy
        </Button>
      </Grid.Col>
    </Grid>
  );

  if (props.isRecording) {
    buttonCluster = (
      <Grid grow justify="center" align="stretch" gutter="xs">
        <Grid.Col span={12}>
          <Button fullWidth onClick={props.stopRecording}>
            Stop Recording
          </Button>
        </Grid.Col>
      </Grid>
    );
  }

  return (
    <>
      <StudyHeader lessonType={quiz?.lessonType} />
      {buttonCluster}
      <p>Card #{quiz.quizId} quiz</p>
      <p>{quiz.repetitions} repetitions</p>
      <p>{quiz.lapses} lapses</p>
      <p>
        {props.totalCards} cards total, {props.quizzesDue} due, {props.newCards}{" "}
        new, {props.awaitingGrades} awaiting grades, {props.queueSize} in study
        Queue,
        {props.pendingFailures} in failure queue.
      </p>
      <p>{linkToEditPage(quiz.cardId)}</p>
    </>
  );
}

type FailurePanelProps = {
  failure: Failure;
  onClose: () => void;
  onFlag: () => void;
};

function FailurePanel(props: FailurePanelProps) {
  const { failure } = props;
  const todo = {
    onFlag: props.onFlag,
    onDiscard: () => alert("TODO"),
    onClose: props.onClose,
  };
  return <QuizFailure {...failure} {...todo} />;
}
function LoadedStudyPage(props: QuizData) {
  const everything = useQuizState(props);
  const { state } = everything;
  const curr = state.currentItem;
  let el: JSX.Element;
  switch (curr.type) {
    case "quiz":
      const quiz = curr.value;
      const quizViewProps: QuizViewProps = {
        quiz,
        awaitingGrades: state.idsAwaitingGrades.length,
        newCards: state.newCards,
        queueSize: Object.keys(state.cardsById).length,
        quizzesDue: state.quizzesDue,
        totalCards: state.totalCards,
        pendingFailures: state.failures.length,
        isRecording: state.isRecording,
        playQuizAudio: everything.playQuizAudio,
        flagQuiz: everything.flagQuiz,
        startRecording: everything.startRecording,
        stopRecording: everything.stopRecording,
      };
      el = <QuizView {...quizViewProps} />;
      break;
    case "failure":
      const failure = curr.value;
      el = (
        <FailurePanel
          failure={failure}
          onClose={() => {
            everything.dispatch({ type: "REMOVE_FAILURE", id: failure.id });
          }}
          onFlag={() => everything.flagQuiz(true)}
        />
      );
      break;
    case "none":
      el = <NoQuizDue />;
      break;
    case "loading":
      el = <div>Loading...</div>;
      break;
    default:
      throw new Error("Unexpected current item " + JSON.stringify(curr));
  }
  return <Container size="xs">{el}</Container>;
}

export default function StudyPage() {
  const mutation = trpc.getNextQuizzes.useMutation();
  let el = <div>Loading...</div>;
  useEffect(() => {
    mutation.mutate({});
  }, []);

  if (mutation.isError) {
    el = <div>Error occurred: {mutation.error.message}</div>;
  }

  if (mutation.isSuccess) {
    el = <LoadedStudyPage {...mutation.data} />;
  }

  return MicrophonePermissions(el);
}
