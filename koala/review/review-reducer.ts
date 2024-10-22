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

    case "SELECT_DIFFICULTY":
      const updatedQuizzes = state.quizzes.map((q, index) => {
        if (index === state.currentQuizIndex) {
          const isCompleted = q.response !== undefined;
          return {
            ...q,
            grade: action.grade,
            status: isCompleted ? "completed" : q.status,
          };
        }
        return q;
      });

      // Check if all quizzes are completed
      const allCompleted = updatedQuizzes.every(
        (q) => q.status === "completed" || q.status === "graded",
      );

      if (allCompleted) {
        // Set status to 'awaitingGrading' for quizzes that require grading
        const quizzesToGrade = updatedQuizzes.map((q) => ({
          ...q,
          status: "awaitingGrading" as const,
        }));

        return {
          ...state,
          quizzes: quizzesToGrade,
        };
      } else {
        // Move to next quiz
        const nextIndex = state.currentQuizIndex + 1;
        return {
          ...state,
          quizzes: updatedQuizzes,
          currentQuizIndex:
            nextIndex < updatedQuizzes.length
              ? nextIndex
              : state.currentQuizIndex,
        };
      }

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
                // If grading failed, default difficulty to 'AGAIN'
                difficulty: action.result === "incorrect" ? "AGAIN" : q.grade,
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
          nextIndex < state.quizzes.length ? nextIndex : state.currentQuizIndex,
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
