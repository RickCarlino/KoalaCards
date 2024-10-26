import { quizReducer } from "@/koala/review/review-reducer";
import { Grade } from "femto-fsrs";
import { useEffect, useReducer, useState } from "react";
import { Card, Title, Text, Stack, Image, Center } from "@mantine/core";
import { DifficultyButtons } from "./grade-buttons";
import { Props, Quiz, QuizComp, QuizProps } from "./types";
import { ListeningQuiz } from "./listening-quiz";
import { ReviewOver } from "./review-over";

const UnknownQuiz: QuizComp = (props) => {
  const [currentGrade, setGrade] = useState<Grade>();
  const handleGrade = (grade: Grade) => {
    setGrade(grade);
    props.onComplete(grade);
  };
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack>
        <Title order={2}>Unknown Quiz ({props.quiz.lessonType})</Title>
        <Text>{props.quiz.definition}</Text>
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
  listening: ListeningQuiz,
  speaking: UnknownQuiz,
  dictation: ListeningQuiz,
};

export const ReviewPage = (props: Props) => {
  const [state, dispatch] = useReducer(quizReducer, {
    quizzes: [],
    currentQuizIndex: 0,
    sessionStatus: "inProgress",
  });

  useEffect(() => {
    dispatch({ type: "LOAD_QUIZZES", quizzes: props.quizzes });
  }, [props.quizzes]);

  const currentQuizState = state.quizzes[state.currentQuizIndex];

  if (currentQuizState) {
    const quiz = currentQuizState.quiz;
    const LessonComponent = quizComponents[quiz.lessonType] || UnknownQuiz;
    const quizProps: QuizProps = {
      quiz: currentQuizState.quiz,
      onComplete(grade) {
        dispatch({ type: "SET_GRADE", grade });
        dispatch({ type: "NEXT_QUIZ" });
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
    return <ReviewOver state={state.quizzes} />;
  }
};
