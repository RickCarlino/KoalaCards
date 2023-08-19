import { PlayButton, playAudio } from "@/components/play-button";
import { RecordButton } from "@/components/record-button";
import { trpc } from "@/utils/trpc";
import { Button, Container, Grid, Header } from "@mantine/core";
import { useReducer } from "react";
import Authed from "./_authed";
import {
  Quiz,
  CurrentQuiz,
  newQuizState,
  quizReducer,
  currentQuiz,
  gotoNextQuiz,
} from "./_study_reducer";

type Props = { quizzes: Quiz[] };

interface CurrentQuizProps {
  quiz: CurrentQuiz;
  inProgress: number;
  doFail: (id: string) => void;
  doFlag: (id: string) => void;
  onRecord: (audio: string) => void;
}

function CurrentQuiz(props: CurrentQuizProps) {
  const { quiz, onRecord, doFail, doFlag, inProgress } = props;
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
        <RecordButton quizType={quiz.quizType} onRecord={onRecord} />
      </Grid.Col>
      <Grid.Col span={4}>
        <Button onClick={() => doFail("" + quiz.id)} fullWidth>
          ❌[F]ail Item
        </Button>
      </Grid.Col>
      <Grid.Col span={4}>
        <Button onClick={() => doFlag("" + quiz.id)} fullWidth>
          🚩Flag Item[R] #{quiz.id}
        </Button>
      </Grid.Col>
    </Grid>
  );
}

function Study({ quizzes }: Props) {
  const phrasesById = quizzes.reduce((acc, quiz) => {
    acc[quiz.id] = quiz;
    return acc;
  }, {} as Record<number, Quiz>);
  const newState = newQuizState({ phrasesById });
  const [state, dispatch] = useReducer(quizReducer, newState);
  const performExam = trpc.performExam.useMutation();
  const failPhrase = trpc.failPhrase.useMutation();
  const flagPhrase = trpc.flagPhrase.useMutation();
  const needBetterErrorHandler = (error: any) => {
    console.error(error);
    dispatch({ type: "ADD_ERROR", message: JSON.stringify(error) });
  };
  const quiz = currentQuiz(state);
  if (!quiz) {
    return <div>Session complete.</div>;
  }
  const header = (() => {
    if (!quiz) return <span></span>;
    return <span>🫣 Card #{quiz.id}</span>;
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
          const { id, quizType } = quiz;
          dispatch({ type: "WILL_GRADE" });
          // Possible race condition here, what happens if
          // the last result of a lesson is "error"?
          // TODO Write tests for when the last result is of type
          // "error".
          const nextQuiz = currentQuiz(gotoNextQuiz(state));
          if (nextQuiz) {
            setTimeout(() => playAudio(nextQuiz.quizAudio), 678);
          }
          performExam
            .mutateAsync({ id, audio, quizType })
            .then((data) => {
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
      <br />
      <pre>{JSON.stringify(quiz, null, 2)}</pre>
      <br />
      <pre>
        {JSON.stringify(
          {
            ...state,
            quizzes: null,
          },
          null,
          2,
        )}
      </pre>
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
