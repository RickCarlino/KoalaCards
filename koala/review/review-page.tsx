import { quizReducer } from "@/koala/review/review-reducer";
import { Grade } from "femto-fsrs";
import { useEffect, useReducer, useState } from "react";
import { Card, Title, Text, Stack, Image, Center } from "@mantine/core";
import { DifficultyButtons } from "./grade-buttons";
import { Props, Quiz, QuizComp, QuizProps } from "./types";
import { ReviewOver } from "./review-over";
import { SpeakingQuiz } from "./speaking-quiz";
import { ListeningQuiz } from "./listening-quiz";
import { trpc } from "../trpc-config";

const UnknownQuiz: QuizComp = (props) => {
  const [currentGrade, setGrade] = useState<Grade>();
  const handleGrade = (grade: Grade) => {
    setGrade(grade);
    props.onGraded(grade);
    setGrade(undefined);
    props.onComplete("pass", "");
    // if (Math.random() < 0.5) {
    //   setTimeout(() => {
    //     props.onComplete("fail", "Fake false feedback");
    //   }, 2000);
    // }
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
  listening: SpeakingQuiz,
  speaking: SpeakingQuiz,
};

export const ReviewPage = (props: Props) => {
  const [state, dispatch] = useReducer(quizReducer, {
    quizzes: [],
    currentQuizIndex: 0,
    sessionStatus: "inProgress",
  });
  const gradeQuiz = trpc.gradeQuiz.useMutation();
  useEffect(() => {
    dispatch({ type: "LOAD_QUIZZES", quizzes: props.quizzes });
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
      },
      onComplete(status, feedback) {
        dispatch({
          type: "RECEIVE_GRADING_RESULT",
          quizId: quiz.quizId,
          result: status,
          serverResponse: feedback || "",
        });
      },
    };
    const illustration = quiz.imageURL ? (
      <Card.Section>
        <Image src={quiz.imageURL} height={160} />
      </Card.Section>
    ) : null;

    return (
      // Center the content both vertically and horizontally
      <Center style={{ width: "100%" }}>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          {illustration}
          <LessonComponent {...quizProps} />
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
