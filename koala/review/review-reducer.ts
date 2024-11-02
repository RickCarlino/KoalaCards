import { Grade } from "femto-fsrs";
import { Action, ReviewState } from "./types";

export function quizReducer(state: ReviewState, action: Action): ReviewState {
  if (action.type !== "LOAD_QUIZZES") {
    console.log(JSON.stringify({
      ...action,
      audioBase64: undefined,
    }, null, 2));
  }

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
                response: action.userResponse,
              }
            : q,
        ),
      };

    case "UPDATE_AUDIO_URL":
      return {
        ...state,
        quizzes: state.quizzes.map((q) =>
          q.quiz.quizId === action.quizId
            ? {
                ...q,
                quiz: {
                  ...q.quiz,
                  termAudio: action.audioBase64,
                },
              }
            : q,
        ),
      };

    case "NEXT_QUIZ":
      const plusOne = state.currentQuizIndex + 1;
      const nextIndex =
        plusOne < state.quizzes.length ? plusOne : state.quizzes.length;

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

      // Adjust the currentQuizIndex if necessary
      let newCurrentQuizIndex = state.currentQuizIndex;
      if (newCurrentQuizIndex >= filteredQuizzes.length) {
        newCurrentQuizIndex = filteredQuizzes.length - 1;
      }

      return {
        ...state,
        quizzes: filteredQuizzes,
        currentQuizIndex: newCurrentQuizIndex,
      };
    default:
      return state;
  }
}
