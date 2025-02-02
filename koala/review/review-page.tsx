import { reviewReducer } from "@/koala/review/review-reducer";
import {
  Card,
  Center,
  Group,
  Image,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Grade } from "femto-fsrs";
import { useEffect, useReducer, useState } from "react";
import { trpc } from "../trpc-config";
import { PauseReviewButton } from "./pause-button";
import { DifficultyButtons } from "./grade-buttons";
import { ListeningQuiz } from "./listening-quiz";
import { ReviewOver } from "./review-over";
import { SpeakingQuiz } from "./speaking-quiz";
import { Props, Quiz, QuizComp, QuizProps } from "./types";
import { EditButton } from "./edit-button";
import RemixButton from "../remix-button";
import { ReviewQuiz } from "./review-quiz";

async function fetchAudioAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const UnknownQuiz: QuizComp = (props) => {
  const [currentGrade, setGrade] = useState<Grade>();
  const handleGrade = (grade: Grade) => {
    setGrade(grade);
    props.onGraded(grade);
    setGrade(undefined);
    props.onComplete({
      status: "pass",
      feedback: "Unknown quiz graded",
      userResponse: "???",
    });
  };
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack>
        <Title order={2}>Unknown Quiz ({props.quiz.quiz.lessonType})</Title>
        <Text>{props.quiz.quiz.definition}</Text>
        <Text>{props.quiz.quiz.term}</Text>
        <DifficultyButtons
          quiz={props.quiz.quiz}
          current={currentGrade}
          onSelectDifficulty={handleGrade}
        />
      </Stack>
    </Card>
  );
};

// Lookup table for quiz components
const quizComponents: Record<Quiz["lessonType"], QuizComp> = {
  dictation: ListeningQuiz,
  listening: ListeningQuiz,
  speaking: SpeakingQuiz,
  review: ReviewQuiz,
};

export const ReviewPage = (props: Props) => {
  const [state, dispatch] = useReducer(reviewReducer, {
    quizzes: [],
    currentQuizIndex: 0,
  });
  const gradeQuiz = trpc.gradeQuiz.useMutation();
  useEffect(() => {
    dispatch({ type: "LOAD_QUIZZES", quizzes: props.quizzes });

    // Prefetch and convert the first quiz's audio URL to base64
    if (props.quizzes.length > 0) {
      const firstQuiz = props.quizzes[0];
      fetchAudioAsBase64(firstQuiz.termAudio).then((audioBase64) => {
        dispatch({
          type: "UPDATE_AUDIO_URL",
          quizId: firstQuiz.quizId,
          audioBase64,
        });
      });
    }
  }, [props.quizzes]);

  const currentQuizState = state.quizzes[state.currentQuizIndex];

  if (currentQuizState) {
    const quiz = currentQuizState.quiz;
    const LessonComponent = quizComponents[quiz.lessonType] || UnknownQuiz;
    const quizProps: QuizProps = {
      quiz: currentQuizState,
      onGraded(grade) {
        dispatch({ type: "SET_GRADE", grade, quizId: quiz.quizId });
        dispatch({ type: "NEXT_QUIZ" });
        // Prefetch and convert the next quiz's audio URL to base64
        const nextQuiz = state.quizzes[state.currentQuizIndex + 1];
        if (nextQuiz) {
          fetchAudioAsBase64(nextQuiz.quiz.termAudio).then((audioBase64) => {
            dispatch({
              type: "UPDATE_AUDIO_URL",
              quizId: nextQuiz.quiz.quizId,
              audioBase64,
            });
          });
        }
      },
      onComplete({ status, feedback, userResponse }) {
        dispatch({
          type: "SERVER_FEEDBACK",
          quizId: quiz.quizId,
          result: status,
          serverResponse: feedback,
          userResponse,
        });
      },
    };

    // Updated illustration rendering
    const illustration = (
      <Card.Section>
        {quiz.imageURL && (
          <Image src={quiz.imageURL} fit="contain" width="100%" />
        )}
      </Card.Section>
    );

    const done = state.quizzes.filter(
      (q) => !!(q.grade || q.serverGradingResult),
    ).length;
    const total = state.quizzes.length;
    const percentage = Math.round((done / total) * 100);
    return (
      // Center the content both vertically and horizontally
      <Center style={{ width: "100%" }}>
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ maxWidth: 600, width: "100%", marginTop: "10px" }} // Set fixed maxWidth
        >
          <Stack>
            <LessonComponent {...quizProps} key={quiz.quizId} />
            <Group grow>
              <PauseReviewButton
                cardID={quiz.cardId}
                onClick={() => {
                  dispatch({ type: "PAUSE_CURRENT_CARD" });
                }}
              />
              <EditButton cardID={quiz.cardId} />
              <RemixButton
                card={{
                  id: quiz.cardId,
                  term: quiz.term,
                  definition: quiz.definition,
                }}
              />
            </Group>
            <Text size={"xs"}>
              {props.quizzesDue} due today. {done} of {total} complete in
              current lesson.{" "}
              {quiz.lapses > 9
                ? "Consider pausing reviews of this very difficult card."
                : ""}
            </Text>
            <Progress radius="lg" size="xl" value={percentage || 1} />
            {illustration}
          </Stack>
        </Card>
      </Center>
    );
  } else {
    const reviewOverProps = {
      state: state.quizzes,
      async onSave() {
        const grades = state.quizzes.map((q) => {
          const perceivedDifficulty =
            q.serverGradingResult === "fail" ? Grade.AGAIN : q.grade;
          console.log(
            `Saving grade ${perceivedDifficulty} for quiz ${q.quiz.definition}`,
          );
          return {
            quizID: q.quiz.quizId,
            perceivedDifficulty,
          };
        });
        await Promise.all(
          grades.map((grade) => {
            if (grade && grade.perceivedDifficulty) {
              gradeQuiz.mutateAsync({
                quizID: grade.quizID,
                perceivedDifficulty: grade.perceivedDifficulty,
              });
            } else {
              // REPRO STEPS, don't care to fix right now:
              // Pause a review quiz before the server finishes grading
              // the final repetition.
              console.warn("No grade to save for quiz", grade.quizID);
            }
          }),
        );
        await props.onSave(); // Fetch more potentially.
      },
      onUpdateDifficulty(quizId: number, grade: Grade) {
        dispatch({ type: "SET_GRADE", grade, quizId });
      },
    };
    return <ReviewOver {...reviewOverProps} />;
  }
};
