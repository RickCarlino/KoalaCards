import { Grade } from "femto-fsrs";
import { Action, ReviewState } from "./types";

export function quizReducer(state: ReviewState, action: Action): ReviewState {
  const plusOne = state.currentQuizIndex + 1;
  const nextIndex =
    plusOne < state.quizzes.length ? plusOne : state.quizzes.length;

  switch (action.type) {
    case "LOAD_QUIZZES":
      return {
        ...state,
        quizzes: action.quizzes.map((quiz) => ({
          quiz,
        })),
        currentQuizIndex: 0,
      };

    case "SET_GRADE":
      return {
        ...state,
        quizzes: state.quizzes.map((q) =>
          q.quiz.quizId === action.quizId
            ? {
                ...q,
                grade: action.grade,
              }
            : q,
        ),
      };

    case "SERVER_FEEDBACK":
      return {
        ...state,
        quizzes: state.quizzes.map((q) =>
          q.quiz.quizId === action.quizId
            ? {
                ...q,
                serverGradingResult: action.result,
                serverResponse: action.serverResponse,
                status: "graded",
                grade: action.result === "fail" ? Grade.AGAIN : q.grade,
              }
            : q,
        ),
      };

    case "NEXT_QUIZ":
      return {
        ...state,
        currentQuizIndex: nextIndex,
      };

    case "FLAG_CURRENT_CARD":
      const currentQuiz = state.quizzes[state.currentQuizIndex];
      if (!currentQuiz) {
        return state;
      }
      const cardID = currentQuiz.quiz.cardId;
      const filteredQuizzes = state.quizzes.filter(
        (q) => q.quiz.cardId !== cardID,
      );

      if (filteredQuizzes.length === 0) {
        // No quizzes left after filtering
        return {
          ...state,
          quizzes: [],
          currentQuizIndex: 0,
        };
      }

      // Map filtered quizzes to their original indices
      const originalIndices = filteredQuizzes.map((q) =>
        state.quizzes.indexOf(q),
      );

      // Find the next quiz index in the original array that's after the current index
      const nextQuizIndex = originalIndices.findIndex(
        (idx) => idx > state.currentQuizIndex,
      );

      const newCurrentQuizIndex = nextQuizIndex !== -1 ? nextQuizIndex : 0; // Wrap around if necessary

      return {
        ...state,
        quizzes: filteredQuizzes,
        currentQuizIndex: newCurrentQuizIndex,
      };

    default:
      return state;
  }
}
