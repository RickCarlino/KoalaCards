import { quizReducer } from "@/koala/review/review-reducer";
import { Grade } from "femto-fsrs";
import { useEffect, useReducer, useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { Props, Quiz, QuizComp, QuizProps } from "./types";

const UnknownQuiz: QuizComp = (props) => {
  const [currentGrade, setGrade] = useState<Grade>();
  const hmm = (grade: Grade) => {
    setGrade(grade);
    props.onComplete(grade);
  };
  return (
    <div>
      <h2>Unknown Quiz</h2>
      <p>{props.quiz.definition}</p>
      <DifficultyButtons current={currentGrade} onSelectDifficulty={hmm} />
    </div>
  );
};

// Lookup table for quiz components
const quizComponents: Record<Quiz["lessonType"], QuizComp> = {
  listening: UnknownQuiz,
  speaking: UnknownQuiz,
  dictation: UnknownQuiz,
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
    const props: QuizProps = {
      quiz: currentQuizState.quiz,
      onComplete(grade) {
        dispatch({ type: "SET_GRADE", grade });
        dispatch({ type: "NEXT_QUIZ" });
      },
    };
    return (
      <div>
        <LessonComponent {...props} />
      </div>
    );
  } else {
    return <div>TODO: Submit grades.</div>;
  }
};
