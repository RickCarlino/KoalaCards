import { quizReducer } from "@/koala/review/review-reducer";
import { Card, Center, Image, Stack, Text, Title } from "@mantine/core";
import { Grade } from "femto-fsrs";
import { useEffect, useReducer, useState } from "react";
import { trpc } from "../trpc-config";
import { FlagButton } from "./flag-button";
import { DifficultyButtons } from "./grade-buttons";
import { ListeningQuiz } from "./listening-quiz";
import { ReviewOver } from "./review-over";
import { SpeakingQuiz } from "./speaking-quiz";
import { Props, Quiz, QuizComp, QuizProps } from "./types";

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
        <Title order={2}>Unknown Quiz ({props.quiz.lessonType})</Title>
        <Text>{props.quiz.definition}</Text>
        <Text>{props.quiz.term}</Text>
        <DifficultyButtons
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
};

export const ReviewPage = (props: Props) => {
  const [state, dispatch] = useReducer(quizReducer, {
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
      quiz: currentQuizState.quiz,
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

    return (
      // Center the content both vertically and horizontally
      <Center style={{ width: "100%" }}>
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ maxWidth: 600, width: "100%" }} // Set fixed maxWidth
        >
          <Stack>
            <LessonComponent {...quizProps} key={quiz.quizId} />
            <FlagButton
              cardID={quiz.cardId}
              onClick={() => {
                dispatch({ type: "FLAG_CURRENT_CARD" });
              }}
            />
            <Text size={"xs"}>{props.quizzesDue} quizzes due today.</Text>
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
          if (!q.grade) {
            alert("Not all quizzes have been graded");
            throw new Error("Not all quizzes have been graded");
          }
          return {
            quizID: q.quiz.quizId,
            perceivedDifficulty: q.grade,
          };
        });
        await Promise.all(grades.map((grade) => gradeQuiz.mutateAsync(grade)));
        await props.onSave(); // Fetch more potentially.
      },
      onUpdateDifficulty(quizId: number, grade: Grade) {
        dispatch({ type: "SET_GRADE", grade, quizId });
      },
    };
    return <ReviewOver {...reviewOverProps} />;
  }
};
