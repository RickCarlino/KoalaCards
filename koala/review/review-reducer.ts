import { Grade } from "femto-fsrs";
import { Action, ReviewState } from "./types";

export function quizReducer(state: ReviewState, action: Action): ReviewState {
  switch (action.type) {
    case "LOAD_QUIZZES":
      return {
        ...state,
        quizzes: action.quizzes.map((quiz) => ({
          quiz,
          status: "pending",
          flagged: false,
          notes: [],
        })),
        currentQuizIndex: 0,
        sessionStatus: "inProgress",
      };

    case "SUBMIT_RESPONSE":
      return {
        ...state,
        quizzes: state.quizzes.map((q, index) =>
          index === state.currentQuizIndex
            ? {
                ...q,
                response: action.response,
              }
            : q,
        ),
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

    case "GIVE_UP":
      return {
        ...state,
        quizzes: state.quizzes.map((q, index) =>
          index === state.currentQuizIndex
            ? {
                ...q,
                difficulty: "AGAIN",
                status: "completed",
              }
            : q,
        ),
      };

    case "FLAG_CARD":
      return {
        ...state,
        quizzes: state.quizzes.map((q, index) =>
          index === state.currentQuizIndex
            ? {
                ...q,
                flagged: true,
              }
            : q,
        ),
      };

    case "ADD_NOTE":
      return {
        ...state,
        quizzes: state.quizzes.map((q, index) =>
          index === state.currentQuizIndex
            ? {
                ...q,
                notes: [...q.notes, action.note],
              }
            : q,
        ),
      };

    case "EDIT_CARD":
      return {
        ...state,
        quizzes: state.quizzes.map((q) =>
          q.quiz.cardId === action.cardId
            ? {
                ...q,
                quiz: {
                  ...q.quiz,
                  ...action.updates,
                },
              }
            : q,
        ),
      };

    case "EXIT_EARLY":
      return {
        ...state,
        sessionStatus: "exitedEarly",
      };

    case "RECEIVE_GRADING_RESULT":
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

    case "UPDATE_DIFFICULTY":
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

    case "FINALIZE_REVIEW":
      return {
        ...state,
        sessionStatus: "finalized",
      };

    case "NEXT_QUIZ":
      const nextIndex = state.currentQuizIndex + 1;
      return {
        ...state,
        currentQuizIndex:
          nextIndex < state.quizzes.length ? nextIndex : state.quizzes.length,
      };

    case "PREVIOUS_QUIZ":
      const prevIndex = state.currentQuizIndex - 1;
      return {
        ...state,
        currentQuizIndex: prevIndex >= 0 ? prevIndex : state.currentQuizIndex,
      };

    default:
      return state;
  }
}
