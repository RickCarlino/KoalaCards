import MicrophonePermissions from "@/koala/microphone-permissions";
import { playAudio } from "@/koala/play-audio";
import { QuizFailure, linkToEditPage } from "@/koala/quiz-failure";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { useUserSettings } from "@/koala/settings-provider";
import {
  Action,
  Quiz,
  State,
  gotoNextQuiz,
  newQuizState,
  quizReducer,
} from "@/koala/study_reducer";
import { timeUntil } from "@/koala/time-until";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Container, Grid } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
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
  flagQuiz: () => Promise<void>;
  startRecording(grade: Grade): Promise<void>;
  stopRecording: () => Promise<void>;
  totalComplete: number;
};

type StudyHeaderProps = {
  lessonType: keyof typeof HEADER;
  langCode: string;
  isRecording: boolean;
};
type QuizAssertion = (q: Quiz | undefined) => asserts q is Quiz;
type HotkeyButtonProps = {
  hotkey: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

const HEADER_STYLES = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "20px",
};
const LANG_CODE_NAMES: Record<string, string> = {
  EN: "English",
  IT: "Italian",
  FR: "French",
  ES: "Spanish",
  KO: "Korean",
};

const DEFAULT = (_lang: string) => "";
const HEADER: Record<string, (lang: string) => string> = {
  speaking: (lang) => {
    const name = LANG_CODE_NAMES[lang] || "the target language";
    return `How would you say this in ${name}?`;
  },
  listening: () => "Translate this phrase to English",
  dictation: (lang) => {
    const name = LANG_CODE_NAMES[lang] || "the target language";
    return "Select difficulty and repeat in " + name;
  },
};

export const HOTKEYS = {
  FAIL: "a",
  HARD: "s",
  GOOD: "d",
  EASY: "f",
  PLAY: "v",
  FLAG: "h",
  DISAGREE: "k",
  AGREE: "j",
};

const GRID_SIZE = 2;

function StudyHeader(props: StudyHeaderProps) {
  const { lessonType, langCode, isRecording } = props;
  const text = (t: string) => {
    return (
      <header style={HEADER_STYLES}>
        <span style={{ fontSize: "18px", fontWeight: "bold" }}>{t}</span>
      </header>
    );
  };

  if (isRecording) {
    return text("🎤 Record your response now");
  }

  const header = (HEADER[lessonType] || DEFAULT)(langCode);

  return text(header);
}

const currentQuiz = (state: State) => {
  const curr = state.currentItem;
  if (curr.type !== "quiz") {
    return;
  }
  return curr.value;
};

const assertQuiz: QuizAssertion = (q) => {
  if (!q) {
    throw new Error("No quiz found");
  }
};

function useBusinessLogic(state: State, dispatch: Dispatch<Action>) {
  const flagCard = trpc.flagCard.useMutation();
  const gradeQuiz = trpc.gradeQuiz.useMutation();
  const getNextQuiz = trpc.getNextQuizzes.useMutation();
  const manuallyGade = trpc.manuallyGrade.useMutation();
  const userSettings = useUserSettings();
  const [perceivedDifficulty, setGrade] = useState(Grade.GOOD);
  const quiz = currentQuiz(state);
  const rollbackData = trpc.rollbackGrade.useMutation();
  const getPlaybackAudio = trpc.getPlaybackAudio.useMutation();
  const onRecord = async (audio: string) => {
    assertQuiz(quiz);
    const id = quiz.quizId;
    dispatch({ type: "END_RECORDING", id: quiz.quizId });
    gradeQuiz
      .mutateAsync({ id, audio, perceivedDifficulty })
      .then(async (data) => {
        if (data.result === "fail") {
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
              playbackAudio: data.playbackAudio,
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
        console.error(error, "Error grading quiz");
        dispatch({
          type: "DID_GRADE",
          id,
          result: "error",
        });
      })
      .finally(() => {
        const isFull = state.quizIDsForLesson.length >= 10;
        getNextQuiz
          .mutateAsync({
            notIn: [
              ...state.quizIDsForLesson,
              ...state.idsAwaitingGrades,
              ...state.idsWithErrors,
            ],
            take: isFull ? 1 : 7,
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
    async flagQuiz() {
      if (!confirm("This will pause reviews. Are you sure?")) {
        return;
      }
      const curr = state.currentItem;
      let id = 0;
      switch (curr.type) {
        case "quiz":
          id = curr.value.cardId;
          break;
        case "failure":
          id = curr.value.cardId;
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
        const { playbackAudio } = await getPlaybackAudio.mutateAsync({ id });
        dispatch({ type: "USER_GAVE_UP", id, playbackAudio });
        manuallyGade.mutateAsync({
          id,
          grade: Grade.AGAIN,
        });
        return;
      } else {
        setGrade(perceivedDifficulty);
        dispatch({ type: "BEGIN_RECORDING" });
        await start();
      }
    },
    async rollbackGrade() {
      const curr = state.currentItem;
      if (curr.type !== "failure") {
        throw new Error("Not a failure?");
      }
      const id = curr.value.id;
      const schedulingData = curr.value.rollbackData;
      schedulingData &&
        rollbackData.mutateAsync({
          id,
          schedulingData,
        });
      dispatch({ type: "REMOVE_FAILURE", id });
    },
  };
}

function useQuizState(props: QuizData) {
  const cardsById = props.quizzes.reduce(
    (acc, quiz) => {
      acc[quiz.quizId] = quiz;
      return acc;
    },
    {} as Record<number, Quiz>,
  );
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
        {/* <li>
          <Link href="/cards">Import cards from a backup file</Link>
        </li> */}
        <li>Refresh this page to load more.</li>
      </ul>
    </div>
  );
}

function HotkeyButton(props: HotkeyButtonProps) {
  return (
    <Grid.Col span={GRID_SIZE}>
      <Button fullWidth onClick={props.onClick} disabled={props.disabled}>
        {props.label} ({props.hotkey.toUpperCase()})
      </Button>
    </Grid.Col>
  );
}

function QuizView(props: QuizViewProps) {
  const { quiz } = props;
  const [maxGrade, setMaxGrade] = useState(Grade.EASY);
  // Reduce maxGrade after a timeout
  // Cancel timer when quizID changes:
  const quizID = props.quiz.quizId;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (quiz.lessonType !== "dictation") {
        setMaxGrade(maxGrade - 1);
      }
    }, 8000);
    return () => {
      clearTimeout(timer);
    };
  }, [maxGrade, quizID]);

  useEffect(() => {
    setMaxGrade(Grade.EASY);
    props.playQuizAudio();
  }, [quizID]);
  const gradeWith = (g: Grade) => async () => {
    const grade = Math.min(g, maxGrade);
    if (props.isRecording) {
      await props.stopRecording();
    } else {
      await props.startRecording(grade);
    }
  };
  useHotkeys([
    [HOTKEYS.PLAY, props.playQuizAudio],
    [HOTKEYS.FLAG, props.flagQuiz],
    [HOTKEYS.FAIL, gradeWith(Grade.AGAIN)],
    [HOTKEYS.HARD, gradeWith(Grade.HARD)],
    [HOTKEYS.GOOD, gradeWith(Grade.GOOD)],
    [HOTKEYS.EASY, gradeWith(Grade.EASY)],
  ]);
  const buttons: HotkeyButtonProps[] = [
    {
      onClick: gradeWith(Grade.AGAIN),
      label: "FAIL",
      hotkey: HOTKEYS.FAIL,
      disabled: false,
    },
    {
      onClick: gradeWith(Grade.HARD),
      label: "Hard",
      hotkey: HOTKEYS.HARD,
      disabled: false,
    },
    {
      onClick: gradeWith(Grade.GOOD),
      label: "Good",
      hotkey: HOTKEYS.GOOD,
      disabled: maxGrade < Grade.GOOD,
    },
    {
      onClick: gradeWith(Grade.EASY),
      label: "Easy",
      hotkey: HOTKEYS.EASY,
      disabled: maxGrade < Grade.EASY,
    },
  ];
  const playAudio = () => {
    setMaxGrade(maxGrade - 1);
    props.playQuizAudio();
  };
  let buttonCluster = (
    <Grid grow justify="center" align="stretch" gutter="xs">
      <Grid.Col span={6}>
        <Button fullWidth onClick={playAudio}>
          Play Audio ({HOTKEYS.PLAY.toUpperCase()})
        </Button>
      </Grid.Col>
      <Grid.Col span={6}>
        <Button fullWidth onClick={props.flagQuiz}>
          Pause Reviews ({HOTKEYS.FLAG.toUpperCase()})
        </Button>
      </Grid.Col>
      {buttons.map((p) => (
        <HotkeyButton {...p} key={p.label} />
      ))}
    </Grid>
  );

  if (props.isRecording) {
    const keys = [HOTKEYS.FAIL, HOTKEYS.HARD, HOTKEYS.GOOD, HOTKEYS.EASY];
    buttonCluster = (
      <Grid grow justify="center" align="stretch" gutter="xs">
        <Grid.Col span={12}>
          <Button fullWidth onClick={props.stopRecording}>
            Finish Recording ({keys.join(", ")})
          </Button>
        </Grid.Col>
      </Grid>
    );
  }

  const when = quiz.lastReview ? timeUntil(quiz.lastReview) : "never";
  return (
    <>
      <StudyHeader
        lessonType={quiz?.lessonType}
        langCode={props.quiz.langCode}
        isRecording={props.isRecording}
      />
      {buttonCluster}
      <p>Quiz #{quiz.quizId}</p>
      <p>{quiz.repetitions} repetitions</p>
      <p>{quiz.lapses} lapses</p>
      <p>Last seen: {when}</p>
      <p>
        {props.totalCards} cards total, {props.quizzesDue} due, {props.newCards}{" "}
        new, {props.awaitingGrades} awaiting grades, {props.queueSize} in study
        Queue,
        {props.pendingFailures} in failure queue,{" "}
      </p>
      <p>{linkToEditPage(quiz.cardId)}</p>
      {quiz.imageURL && <img width={"90%"} src={quiz.imageURL} alt="quiz" />}
    </>
  );
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
        totalComplete: everything.state.totalComplete,
      };
      el = <QuizView {...quizViewProps} />;
      break;
    case "failure":
      const failure = curr.value;
      el = (
        <QuizFailure
          {...failure}
          onDiscard={everything.rollbackGrade}
          onClose={() => {
            everything.dispatch({ type: "REMOVE_FAILURE", id: failure.id });
          }}
          onFlag={everything.flagQuiz}
        />
      );
      break;
    case "none":
      const willGrade = state.idsAwaitingGrades.length;
      if (willGrade) {
        el = <div>Waiting for the server to grade {willGrade} quizzes.</div>;
        break;
      }
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
    mutation.mutate({ notIn: [], take: 10 });
  }, []);

  if (mutation.isError) {
    el = <div>Error occurred: {mutation.error.message}</div>;
  }

  if (mutation.isSuccess) {
    el = <LoadedStudyPage {...mutation.data} />;
  }

  return MicrophonePermissions(el);
}
