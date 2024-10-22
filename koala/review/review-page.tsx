import { quizReducer } from "@/koala/review/review-reducer";
import { useEffect, useReducer } from "react";
import { Props, Quiz, QuizComp, QuizProps } from "./types";
import { DifficultyButtons } from "./grade-buttons";

const UnknownQuiz: QuizComp = (_) => {
  return (
    <div>
      <h2>Unknown Quiz</h2>
      <p>Will fill this out later.</p>
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
      onComplete() {
        alert("TODO");
      },
    };
    return (
      <div>
        <LessonComponent {...props} />
        <DifficultyButtons
          current={currentQuizState.grade}
          onSelectDifficulty={(grade) => {
            dispatch({ type: "SELECT_DIFFICULTY", grade });
          }}
        />
      </div>
    );
  } else {
    return <div>TODO: Submit grades.</div>;
  }
};
