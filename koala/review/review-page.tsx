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
import { FlagButton } from "./flag-button";

const UnknownQuiz: QuizComp = (props) => {
  const [currentGrade, setGrade] = useState<Grade>();
  const handleGrade = (grade: Grade) => {
    setGrade(grade);
    props.onGraded(grade);
    setGrade(undefined);
    props.onComplete("pass", "");
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
          type: "SERVER_FEEDBACK",
          quizId: quiz.quizId,
          result: status,
          serverResponse: feedback || "",
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
            <LessonComponent {...quizProps} />
            <FlagButton
              cardID={quiz.cardId}
              onClick={() => {
                dispatch({ type: "FLAG_CURRENT_CARD" });
              }}
            />
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
